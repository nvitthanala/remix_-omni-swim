import sys
import json
import logging
import re
from collections import defaultdict

# SCORING order: Gold (20), Silver (17), Bronze (16), 4th (15), 5th (14), 6th (13), 7th (12), 8th (11), 9th (9), 10th (7), 11th (6), 12th (5), 13th (4), 14th (3), 15th (2), 16th (1)
DEFAULT_NCAA_D2_SCORING = [20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1]

def _resolve_scoring_settings(scoring_settings=None):
    """Determines scoring configuration settings."""
    import os
    cfg = {}
    if not scoring_settings:
        try:
            with open('scoring_settings.json', 'r') as f:
                settings_file = json.load(f)
                for k, v in settings_file.items():
                    if isinstance(v, dict) and 'value' in v:
                        cfg[k] = v['value']
                    else:
                        cfg[k] = v
        except Exception:
            pass
    else:
        cfg = dict(scoring_settings)

    cfg.setdefault('scoringPoints', DEFAULT_NCAA_D2_SCORING)
    cfg.setdefault('relayMultiplier', 2)
    cfg.setdefault('halfRateRelaySwimmer', True)
    cfg.setdefault('maxIndividualScorersPerTeam', 999)
    # Enforce the hard cap of relays
    cfg['maxRelaysScoringPerTeam'] = min(int(cfg.get('maxRelaysScoringPerTeam', 2)), 2)
    cfg.setdefault('maxRosterSize', 99)
    cfg.setdefault('unscoredRounds', ['C FINAL'])
    cfg.setdefault('exhibitionMarkers', ['x', 'X'])
    cfg.setdefault('timeTrialMarkers', ['TIME TRIAL', 'TT'])
    return cfg

def allowed_rounds_for_conference(conf):
    """Return a set of round name fragments that are considered scoring for the conference."""
    return set(['A FINAL', 'B FINAL', 'CHAMPIONSHIP FINAL', 'FINALS'])

def time_to_sec(t):
    if not t or t == 'NT': return 9999.99
    val = re.sub(r'[^\d\.:]', '', t).rstrip('.') 
    if not val: return 9999.99
    
    if ':' in val:
        parts = val.split(':')
        try:
            minutes = float(parts[0])
            seconds = float(parts[1]) if len(parts) > 1 else 0.0
            return minutes * 60 + seconds
        except ValueError:
            return 9999.99
    try:
        return float(val)
    except ValueError:
        return 9999.99

def get_sort_key(a):
    rank = a.get('rank')
    rnum = None
    if rank:
        s = str(rank)
        m = re.search(r"(\d+)", s)
        rnum = int(m.group(1)) if m else None

    t_final = a.get('finals_time') or a.get('prelims_time')
    t_pre = a.get('prelims_time')
    t = None
    if t_final:
        t = time_to_sec(t_final)
    elif t_pre:
        t = time_to_sec(t_pre)

    is_exh = a.get('is_exhibition', False)
    is_tt = a.get('is_time_trial', False)
    
    if is_exh or is_tt:
        return (99999, 99999 + (t or 0), 1)

    if rnum is not None:
        return (rnum, (t or 0), 0)
    
    return (10000 + 1, (t or 0), 0)

def calculate_points(athletes, scoring_settings=None):
    cfg = _resolve_scoring_settings(scoring_settings)
    SCORING = cfg['scoringPoints']
    relay_multiplier = cfg['relayMultiplier']
    half_rate_relay = cfg['halfRateRelaySwimmer']
    max_relays_cfg = cfg['maxRelaysScoringPerTeam'] 
    max_individuals_cfg = cfg['maxIndividualScorersPerTeam']

    # Enrich athletes with exhibition and time trial markers from settings
    for ath in athletes:
        ev_name = str(ath.get('event', '')).upper()
        rank_str = str(ath.get('rank', ''))
        t_final = str(ath.get('finals_time', ''))
        t_pre = str(ath.get('prelims_time', ''))

        ath['is_exhibition'] = False
        ath['is_time_trial'] = False

        for marker in cfg.get('exhibitionMarkers', ['x', 'X']):
            if marker in rank_str or marker in t_final or marker in t_pre:
                ath['is_exhibition'] = True
                
        for marker in cfg.get('timeTrialMarkers', ['TIME TRIAL', 'TT']):
            if re.search(r'\b' + re.escape(marker) + r'\b', ev_name):
                ath['is_time_trial'] = True

    events = {}
    for ath in athletes:
        key = (ath['event'], ath['gender'])
        if key not in events:
            events[key] = []
        events[key].append(ath)
        
    scored_athletes = []

    for (event, gender), ev_athletes in events.items():
        is_relay = any(a.get('is_relay') for a in ev_athletes)
        
        for a in ev_athletes:
            a['podium'] = 'gold' if str(a.get('rank')) == '1' else \
                          'silver' if str(a.get('rank')) == '2' else \
                          'bronze' if str(a.get('rank')) == '3' else None
            a['cutline_achieved'] = a.get('is_cutline', False) 
            a['calculated_points'] = "N/A"

        if is_relay:
            teams = defaultdict(list)
            for a in ev_athletes:
                t_key = (a.get('team'), a.get('rank'), a.get('finals_time') or a.get('prelims_time'))
                teams[t_key].append(a)
                
            sorted_keys = sorted(list(teams.keys()), key=lambda k: get_sort_key(teams[k][0]))

            scored_count = 0
            team_scoring_metrics = defaultdict(lambda: {'relays': 0})
            
            for (team, rank, time) in sorted_keys:
                group = teams[(team, rank, time)] 
                grp_len = len(group)
                start = scored_count
                end = min(scored_count + 1, len(SCORING)) # Relay takes 1 place in scoring list
                pts_slice = SCORING[start:end]
                
                if pts_slice:
                    team_pts_val = pts_slice[0] * relay_multiplier
                else:
                    team_pts_val = 0
                
                team_athlete = group[0] 
                is_exhibition = team_athlete.get('is_exhibition', False)
                is_time_trial = team_athlete.get('is_time_trial', False)

                conf = team_athlete.get('conference')
                allowed = allowed_rounds_for_conference(conf)
                round_swam_up = str(team_athlete.get('round_swam', '')).upper()
                ev_name = str(team_athlete.get('event','')).upper()
                is_distance = bool(re.search(r'\b(\d{3,})\b', ev_name)) or 'TIMED' in ev_name 

                unscored_rounds = cfg.get('unscoredRounds', [])
                is_unscored_round = any(ur.upper() in ev_name or ur.upper() in round_swam_up for ur in unscored_rounds)

                is_scoring_round = (any(r in round_swam_up for r in allowed) and not is_unscored_round) or \
                                   (is_distance and 'PRELIM' in round_swam_up and not is_unscored_round)

                can_score = is_scoring_round and not is_exhibition and not is_time_trial

                if can_score and scored_count < len(SCORING):
                    team_name = team_athlete.get('team')
                    current_relays = team_scoring_metrics[team_name]['relays']
                    
                    if current_relays < max_relays_cfg:
                        team_scoring_metrics[team_name]['relays'] += 1
                        num_swimmers = grp_len 
                        
                        if half_rate_relay and num_swimmers <= 4:
                            divisor = 4.0 if num_swimmers >= 4 else num_swimmers
                            swimmer_pts = team_pts_val / divisor if divisor > 0 else 0
                        else:
                            swimmer_pts = team_pts_val / num_swimmers if num_swimmers > 0 else 0
                        
                        for a in group:
                            a['calculated_points'] = swimmer_pts
                        scored_count += 1
                
                scored_athletes.extend(group)

        else:
            ev_athletes.sort(key=get_sort_key)
            scored_count = 0
            
            i = 0
            while i < len(ev_athletes):
                group = [ev_athletes[i]]
                def indiv_key(a):
                    return (a.get('rank'), a.get('finals_time') or a.get('prelims_time'))
                j = i + 1
                key = indiv_key(group[0])
                while j < len(ev_athletes) and indiv_key(ev_athletes[j]) == key:
                    group.append(ev_athletes[j])
                    j += 1
                
                i = j 

                team_athlete = group[0] 
                is_exhibition = team_athlete.get('is_exhibition', False)
                is_time_trial = team_athlete.get('is_time_trial', False)

                conf = team_athlete.get('conference')
                allowed = allowed_rounds_for_conference(conf)
                round_swam_up = str(team_athlete.get('round_swam', '')).upper()
                ev_name = str(team_athlete.get('event','')).upper()
                is_distance = bool(re.search(r'\b(\d{3,})\b', ev_name)) or 'TIMED' in ev_name 

                unscored_rounds = cfg.get('unscoredRounds', [])
                is_unscored_round = any(ur.upper() in ev_name or ur.upper() in round_swam_up for ur in unscored_rounds)

                is_scoring_round = (any(r in round_swam_up for r in allowed) and not is_unscored_round) or \
                                   (is_distance and 'PRELIM' in round_swam_up and not is_unscored_round)

                can_score = is_scoring_round and not is_exhibition and not is_time_trial
                grp_len = len(group)

                if can_score and scored_count < len(SCORING):
                    start = scored_count
                    end = min(scored_count + grp_len, len(SCORING))
                    pts_slice = SCORING[start:end]
                    
                    if pts_slice:
                        for index, pts in enumerate(pts_slice):
                            for athlete in group:
                                athlete['calculated_points'] = pts 
                        # Average tie points if multiple tie for same spot but pool is smaller? 
                        # Actually standard ties split points:
                        if grp_len > 1 and len(pts_slice) > 0:
                            avg_pts = sum(pts_slice) / grp_len
                            for athlete in group:
                                athlete['calculated_points'] = avg_pts
                    
                    scored_count += grp_len

                scored_athletes.extend(group)

    return scored_athletes

if __name__ == "__main__":
    input_data = sys.stdin.read()
    if input_data:
        try:
            athletes = json.loads(input_data)
            scored = calculate_points(athletes)
            print(json.dumps(scored))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
