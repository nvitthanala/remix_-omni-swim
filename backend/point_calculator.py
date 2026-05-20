import sys

import json

import re

from collections import defaultdict



DEFAULT_NCAA_D2_SCORING = [20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1]





def _resolve_scoring_settings(scoring_settings=None):

    import os

    from pathlib import Path



    cfg = {}

    if not scoring_settings:

        try:

            settings_path = None

            data_dir = os.environ.get('OMNI_DATA_DIR')

            if data_dir:

                candidate = Path(data_dir) / 'scoring_settings.json'

                if candidate.is_file():

                    settings_path = str(candidate)

            if not settings_path:

                repo_root = Path(__file__).resolve().parent.parent

                for candidate in (

                    repo_root / 'data' / 'scoring_settings.json',

                    repo_root / 'scoring_settings.json',

                    Path('scoring_settings.json'),

                ):

                    if candidate.is_file():

                        settings_path = str(candidate.resolve())

                        break

            if settings_path:

                with open(settings_path, 'r', encoding='utf-8') as f:

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

    cfg.setdefault('maxRelaysScoringPerTeam', 999)

    cfg.setdefault('scorerCapScope', 'event')

    cfg.setdefault('diverScorerWeight', 1)

    cfg.setdefault('relayEligibleFromScorerPool', False)

    cfg['maxRelaysScoringPerTeam'] = min(int(cfg.get('maxRelaysScoringPerTeam', 2)), 2)

    cfg.setdefault('maxRosterSize', 99)

    cfg.setdefault('unscoredRounds', ['C FINAL', 'C-FINAL', 'BONUS FINAL', 'D FINAL', 'D-FINAL', 'TIME TRIAL'])

    cfg.setdefault('exhibitionMarkers', ['x', 'X'])

    cfg.setdefault('timeTrialMarkers', ['TIME TRIAL', 'TT'])

    npts = len(cfg['scoringPoints'])

    cfg.setdefault('aFinalBracketSize', max(1, npts // 2))

    return cfg





def classify_round_tier(round_swam):

    r = (round_swam or '').upper()

    if 'TIME TRIAL' in r or 'TIME TRIALS' in r:

        return 'TT'

    if 'C FINAL' in r or 'C-FINAL' in r or 'BONUS FINAL' in r:

        return 'C'

    if 'D FINAL' in r or 'D-FINAL' in r:

        return 'D'

    if 'PRELIM' in r:

        return 'PRE'

    if 'B FINAL' in r or 'B-FINAL' in r or 'CONSOLATION' in r:

        return 'B'

    if 'A FINAL' in r or 'A-FINAL' in r or 'CHAMPIONSHIP' in r:

        return 'A'

    if 'FINALS' in r:

        return 'A'

    return 'UNK'





def is_distance_event(event_name):

    u = (event_name or '').upper()

    return bool(re.search(r'\b(1000|1650|1500|800|10000)\b', u)) or 'TIMED' in u





def is_diving_event(event_name, cfg=None):

    u = (event_name or '').upper()

    patterns = (cfg or {}).get('diverEventPattern') if cfg else None

    if patterns:

        for p in patterns:

            token = str(p).upper()

            if token == 'DIVE':

                if re.search(r'\bDIVE\b', u):

                    return True

            elif token in u:

                return True

        return False

    return 'DIVING' in u or bool(re.search(r'\bDIVE\b', u))





def is_unscored_round_or_event(round_swam, event_name, cfg):

    r = (round_swam or '').upper()

    e = (event_name or '').upper()

    for ur in cfg.get('unscoredRounds', []):

        u = ur.upper()

        if u in r or u in e:

            return True

    if 'TIME TRIAL' in e:

        return True

    return False





def can_score_swim(round_swam, event_name, cfg):

    if is_unscored_round_or_event(round_swam, event_name, cfg):

        return False

    tier = classify_round_tier(round_swam)

    if tier in ('TT', 'C', 'D'):

        return False

    if tier == 'PRE':

        return is_distance_event(event_name)

    return True





def parse_rank_int(a):

    rk = a.get('rank')

    if rk is None:

        return None

    m = re.search(r'(\d+)', str(rk))

    return int(m.group(1)) if m else None





def scoring_row_index(round_swam, rank_int, event_name, cfg):

    if rank_int is None or rank_int < 1:

        return None

    if not can_score_swim(round_swam, event_name, cfg):

        return None

    pts = cfg['scoringPoints']

    if not pts:

        return None

    bracket = int(cfg.get('aFinalBracketSize', len(pts) // 2))

    tier = classify_round_tier(round_swam)

    if tier == 'B':

        return _scoring_row_index_b_final(rank_int, bracket, len(pts))

    idx = rank_int - 1

    return idx if 0 <= idx < len(pts) else None





def _scoring_row_index_b_final(rank_int, bracket, pts_len):

    if rank_int < 1:

        return None

    last_place = min(pts_len, bracket * 2)

    if rank_int > bracket:

        if rank_int < bracket + 1 or rank_int > last_place:

            return None

        idx = rank_int - 1

        return idx if 0 <= idx < pts_len else None

    idx = bracket + (rank_int - 1)

    return idx if 0 <= idx < pts_len else None





def scoring_row_index_for_relay(round_swam, rank_int, event_name, cfg):

    return scoring_row_index(round_swam, rank_int, event_name, cfg)





def round_tier_sort_order(round_swam):

    tier = classify_round_tier(round_swam)

    return {'A': 1, 'UNK': 1, 'B': 2, 'PRE': 3, 'C': 8, 'D': 8, 'TT': 9}.get(tier, 5)





def time_to_sec(t):

    if not t or t == 'NT':

        return 9999.99

    val = re.sub(r'[^\d\.:]', '', str(t)).rstrip('.')

    if not val:

        return 9999.99

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





def get_ev_sort_key(a):

    t_final = a.get('finals_time') or a.get('prelims_time')

    t = time_to_sec(t_final) if t_final else 9999.99

    is_exh = a.get('is_exhibition', False)

    is_tt = a.get('is_time_trial', False)

    if is_exh or is_tt:

        return (99999, 99999, t)

    rnum = parse_rank_int(a)

    if rnum is None:

        rnum = 9999

    return (round_tier_sort_order(a.get('round_swam')), rnum, t)





def event_meet_sort_key(event_name):

    m = re.search(r'Event\s+(\d+)', event_name or '', re.I)

    return int(m.group(1)) if m else 99999





def _norm_name(name):

    return re.sub(r'\s+', ' ', (name or '').strip().lower())





def _scorer_weight(event_name, cfg):

    if not is_diving_event(event_name, cfg):

        return 1.0

    return cfg.get('diverScorerWeight', 1)





def _pool_total(pool):

    return sum(pool.values())





def _in_pool(pool, name):

    return _norm_name(name) in pool





def _can_add_to_pool(pool, name, event_name, cfg):

    cap = float(cfg.get('maxIndividualScorersPerTeam', 18))

    if cap >= 999:

        return True

    key = _norm_name(name)

    if key in pool:

        return True

    return _pool_total(pool) + _scorer_weight(event_name, cfg) <= cap + 1e-9





def _add_to_pool(pool, name, event_name, cfg):

    key = _norm_name(name)

    if key not in pool:

        pool[key] = _scorer_weight(event_name, cfg)





def _meet_state_key(team, gender):

    return f"{team}|||{gender or ''}"





def calculate_points(athletes, scoring_settings=None):

    cfg = _resolve_scoring_settings(scoring_settings)

    SCORING = cfg['scoringPoints']

    relay_multiplier = cfg['relayMultiplier']

    half_rate_relay = cfg['halfRateRelaySwimmer']

    max_relays_cfg = cfg['maxRelaysScoringPerTeam']

    max_individuals_cfg = cfg['maxIndividualScorersPerTeam']

    use_meet_caps = cfg.get('scorerCapScope') == 'meet' or max_individuals_cfg < 999

    relay_pool_rule = cfg.get('relayEligibleFromScorerPool', False)



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

        if re.search(r'\bTIME\s+TRIAL\b', ev_name):

            ath['is_time_trial'] = True



    events = defaultdict(list)

    for ath in athletes:

        events[(ath['event'], ath['gender'])].append(ath)



    meet_states = {}

    scored_athletes = []



    sorted_event_keys = sorted(events.keys(), key=lambda k: event_meet_sort_key(k[0]))



    for (event, gender), ev_athletes in [(k, events[k]) for k in sorted_event_keys]:

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

                t_key = (

                    a.get('team'),

                    a.get('round_swam') or '',

                    a.get('rank'),

                    a.get('finals_time') or a.get('prelims_time'),

                )

                teams[t_key].append(a)



            sorted_keys = sorted(list(teams.keys()), key=lambda k: get_ev_sort_key(teams[k][0]))

            team_relay_counts = defaultdict(int)



            for t_key in sorted_keys:

                group = teams[t_key]

                team_athlete = group[0]

                is_exhibition = team_athlete.get('is_exhibition', False)

                is_time_trial = team_athlete.get('is_time_trial', False)

                ev_nm = str(team_athlete.get('event', '') or '')

                rs = str(team_athlete.get('round_swam', '') or '')

                rk = parse_rank_int(team_athlete)

                team_name = team_athlete.get('team')



                can_score = (

                    not is_exhibition

                    and not is_time_trial

                    and can_score_swim(rs, ev_nm, cfg)

                )

                idx = scoring_row_index_for_relay(rs, rk, ev_nm, cfg) if can_score else None



                if idx is None:

                    for a in group:

                        a['calculated_points'] = 0.0

                    scored_athletes.extend(group)

                    continue



                mkey = _meet_state_key(team_name, gender)

                if use_meet_caps:

                    if mkey not in meet_states:

                        meet_states[mkey] = {'pool': {}, 'relays': 0}

                    mstate = meet_states[mkey]

                    relay_count = mstate['relays']

                else:

                    relay_count = team_relay_counts[team_name]



                if relay_count >= max_relays_cfg:

                    for a in group:

                        a['calculated_points'] = 0.0

                    scored_athletes.extend(group)

                    continue



                if use_meet_caps and relay_pool_rule:

                    pool = meet_states[mkey]['pool']

                    if not all(_in_pool(pool, a.get('name')) for a in group):

                        for a in group:

                            a['calculated_points'] = 0.0

                        scored_athletes.extend(group)

                        continue



                team_pts_val = SCORING[idx] * relay_multiplier

                num_swimmers = len(group)

                if half_rate_relay and num_swimmers <= 4:

                    divisor = 4.0 if num_swimmers >= 4 else num_swimmers

                    swimmer_pts = team_pts_val / divisor if divisor > 0 else 0

                else:

                    swimmer_pts = team_pts_val / num_swimmers if num_swimmers > 0 else 0



                if use_meet_caps:

                    meet_states[mkey]['relays'] += 1

                else:

                    team_relay_counts[team_name] += 1



                for a in group:

                    a['calculated_points'] = swimmer_pts

                scored_athletes.extend(group)



        else:

            ind_by_key = defaultdict(list)

            for a in ev_athletes:

                rk = parse_rank_int(a)

                if rk is None or rk < 1:

                    key = (a.get('round_swam') or '', -1, id(a))

                else:

                    key = (a.get('round_swam') or '', rk)

                ind_by_key[key].append(a)



            sorted_groups = sorted(ind_by_key.values(), key=lambda grp: get_ev_sort_key(grp[0]))

            team_indiv_counts = defaultdict(int)



            for group in sorted_groups:

                team_athlete = group[0]

                is_exhibition = team_athlete.get('is_exhibition', False)

                is_time_trial = team_athlete.get('is_time_trial', False)

                ev_nm = str(team_athlete.get('event', '') or '')

                rs = str(team_athlete.get('round_swam', '') or '')

                rk = parse_rank_int(team_athlete)

                grp_len = len(group)



                if is_exhibition or is_time_trial or not can_score_swim(rs, ev_nm, cfg):

                    for athlete in group:

                        athlete['calculated_points'] = 0.0

                    scored_athletes.extend(group)

                    continue



                base_idx = scoring_row_index(rs, rk, ev_nm, cfg)

                if base_idx is None:

                    for athlete in group:

                        athlete['calculated_points'] = 0.0

                    scored_athletes.extend(group)

                    continue



                avail = len(SCORING) - base_idx

                take = min(grp_len, avail)

                slice_pts = SCORING[base_idx : base_idx + take]

                if not slice_pts:

                    for athlete in group:

                        athlete['calculated_points'] = 0.0

                    scored_athletes.extend(group)

                    continue



                avg_pts = sum(slice_pts) / grp_len



                by_team = defaultdict(list)

                for athlete in group:

                    by_team[athlete.get('team')].append(athlete)



                for team_name, members in by_team.items():

                    mkey = _meet_state_key(team_name, gender)

                    if use_meet_caps:

                        if mkey not in meet_states:

                            meet_states[mkey] = {'pool': {}, 'relays': 0}

                        pool = meet_states[mkey]['pool']

                        unique_names = list({a.get('name') for a in members})

                        can_all = all(_can_add_to_pool(pool, n, ev_nm, cfg) for n in unique_names)

                        for athlete in members:

                            athlete['calculated_points'] = avg_pts if can_all else 0.0

                        if can_all:

                            for n in unique_names:

                                _add_to_pool(pool, n, ev_nm, cfg)

                    else:

                        cap = max_individuals_cfg

                        for athlete in members:

                            if cap < 999 and team_indiv_counts[team_name] >= cap:

                                athlete['calculated_points'] = 0.0

                            else:

                                athlete['calculated_points'] = avg_pts

                                if cap < 999:

                                    team_indiv_counts[team_name] += 1



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


