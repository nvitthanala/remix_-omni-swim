import sys
import json
import logging
import re
from collections import defaultdict

# SCORING order: Gold (20), Silver (17), Bronze (16), 4th (15), 5th (14), 6th (13), 7th (12), 8th (11), 9th (9), 10th (7), 11th (6), 12th (5), 13th (4), 14th (3), 15th (2), 16th (1)
DEFAULT_NCAA_D2_SCORING = [20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1]

def _resolve_scoring_settings(scoring_settings=None):
    """Determines scoring configuration settings."""
    # Default: standard conference meet scoring.
    if not scoring_settings:
        return {
            'scoringPoints': DEFAULT_NCAA_D2_SCORING,
            'relayMultiplier': 2,
            'halfRateRelaySwimmer': True,
            'maxIndividualScorersPerTeam': 999,  # No cap for conference scoring
            'maxRelaysScoringPerTeam': 2,         # Hard limit: A and B finals only (A & B only)
            'maxRosterSize': 99
        }
    cfg = dict(scoring_settings)
    cfg.setdefault('scoringPoints', DEFAULT_NCAA_D2_SCORING)
    cfg.setdefault('relayMultiplier', 2)
    cfg.setdefault('halfRateRelaySwimmer', True)
    cfg.setdefault('maxIndividualScorersPerTeam', 999)
    # Enforce the hard cap of 2 relays for A/B finals, regardless of external settings that might try to raise it.
    cfg['maxRelaysScoringPerTeam'] = min(int(cfg.get('maxRelaysScoringPerTeam', 999)), 2)
    cfg.setdefault('maxRosterSize', 99)
    return cfg


def allowed_rounds_for_conference(conf):
    """Return a set of round name fragments that are considered scoring for the conference."""
    # NSISC: All championship finals (A, B, and C) are generally unscored in NSISC. This logic handles the exclusion.
    if conf and str(conf).upper() == 'NSISC':
        return set() # Empty set ensures no rounds are scored by default for NSISC
    # Default: explicit finals A/B/C and championship final only.
    return set(['A FINAL', 'B FINAL', 'C FINAL', 'CHAMPIONSHIP FINAL', 'FINALS'])

def time_to_sec(t):
    if not t or t == 'NT': return 9999.99
    # Clean non-numeric/colons characters and remove period trailing noise
    val = re.sub(r'[^\d\.:]', '', t).rstrip('.') 
    if not val: return 9999.99
    
    if ':' in val:
        parts = val.split(':')
        # Handle potential for single-digit minutes (e.g., '1:5')
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
    """Helper function to generate sort keys: Rank (primary), Time (secondary). Returns a tuple for sorting."""
    # 1. Extract numerical rank if present (most reliable scoring indicator)
    rank = a.get('rank')
    rnum = None
    if rank:
        s = str(rank)
        m = re.search(r"(\d+)", s)
        rnum = int(m.group(1)) if m else None

    # 2. Determine the primary time for sorting (Finals > Prelims > other)
    t_final = a.get('finals_time') or a.get('prelims_time')
    t_pre = a.get('prelims_time')
    t = None
    if t_final:
        t = time_to_sec(t_final)
    elif t_pre:
        t = time_to_sec(t_pre)

    # 3. Determine sort tuple based on priority (Rank, Time, Exclusion/Exhibition Flag)
    
    is_exh = a.get('is_exhibition', False)
    is_tt = a.get('is_time_trial', False)
    
    if is_exh or is_tt:
        # Exhibitions and time-trials go last (highest rank, max time)
        return (99999, 99999 + t, 1)

    # If we have a clear rank, use it as the primary sort key.
    if rnum is not None:
        # Use rank and performance time for stable sorting in scored events.
        return (rnum, t, 0)
    
    # Otherwise, rely purely on the best available time for general chronological ordering.
    return (10000 + 1, t, 0)

def calculate_points(athletes, scoring_settings=None):
    """
    Calculates points for all athletes based on rank, round, and event type (individual/relay).
    Handles exclusions: NSISC C finals, exhibition swims, time trials, etc.
    Enriches athlete data with performance details required for front-end visualization 
    (podium status, cutlines, times) and returns a comprehensive dictionary containing scores, totals, 
    and detailed performer data for frontend consumption.
    """
    # 1. Group athletes by Event and Gender, which is a consistent scoring unit.
    events = {}
    for ath in athletes:
        # Key: (Event Name, Gender)
        key = (ath['event'], ath['gender'])
        if key not in events:
            events[key] = []
        events[key].append(ath)
        
    all_calculated_athletes = {}

    cfg = _resolve_scoring_settings(scoring_settings)
    SCORING = cfg['scoringPoints']
    relay_multiplier = cfg['relayMultiplier']
    half_rate_relay = cfg['halfRateRelaySwimmer']
    max_relays_cfg = cfg['maxRelaysScoringPerTeam'] 
    max_individuals_cfg = cfg['maxIndividualScorersPerTeam']

    # --- Start Event Processing Loop ---
    event_results = []

    for (event, gender), ev_athletes in events.items():
        is_relay = any(a.get('is_relay') for a in ev_athletes)
        
        # 2. Define sorting logic
        event_data = {
            'event': event, 
            'gender': gender, 
            'is_relay': is_relay, 
            'athletes_details': [], # List of all athletes for detailed display/hover table
            'team_scores': defaultdict(float) # Scores calculated for the teams in this specific event
        }

        # Populate initial athlete details list (used for hover table data)
        for a in ev_athletes:
            # Add standard performance metadata required by frontend visualization
            a['podium'] = 'gold' if str(a.get('rank')) == '1' else \
                          'silver' if str(a.get('rank')) == '2' else \
                          'bronze' if str(a.get('rank')) == '3' else None
            # Assuming a flag or method exists to check cutlines and pre-qualifying status
            a['cutline_achieved'] = a.get('is_cutline', False) 
            
            event_data['athletes_details'].append({
                'athlete': a, 
                'calculated_points': None # Will be updated later
            })


        if is_relay:
            # --- RELAY POINT CALCULATION ---
            
            teams = defaultdict(list)
            for a in ev_athletes:
                # Use rank and primary time as the key for grouping identical results
                t_key = (a['team'], a.get('rank'), a.get('finals_time') or a.get('prelims_time'))
                teams[t_key].append(a)
                
            # Sort keys to process scoring in ranked order using the new key function
            sorted_keys = sorted(list(teams.keys()), key=lambda k: get_sort_key(k[1][0]))
            all_calculated_athletes = {} # Tracks all athletes with assigned points for this event

            scored_count = 0
            max_relays = max_relays_cfg
            team_scoring_metrics = defaultdict(lambda: {'relays': 0})
            
            for (team, rank, time) in sorted_keys:
                # Get all swimmers belonging to this ranked team/time group
                group = teams[(team, rank, time)] 
                
                grp_len = len(group)
                start = scored_count
                end = min(scored_count + grp_len, len(SCORING))
                pts_slice = SCORING[start:end]
                
                if pts_slice:
                    avg_point = sum(pts_slice) / len(pts_slice)
                else:
                    avg_point = 0
                team_pts_val = avg_point * relay_multiplier
                
                # Check for scoring eligibility based on complex rules (NSISC C finals, X swims, TTs)
                team_athlete = group[0] 
                is_exhibition = team_athlete.get('is_exhibition', False)
                is_time_trial = team_athlete.get('is_time_trial', False) or 'TIME TRIAL' in team_athlete.get('event', '').upper()

                conf = team_athlete.get('conference')
                allowed = allowed_rounds_for_conference(conf)
                round_swam_up = team_athlete.get('round_swam', '').upper()
                ev_name = team_athlete.get('event','').upper()
                is_distance = bool(re.search(r'\b(\d{3,})\b', ev_name)) or 'TIMED' in ev_name 

                # NSISC C Finals exclusion check: A round is unscored if (Conference is NSISC AND Round/Event contains 'C FINAL').
                is_c_finals_unscored = ('NSISC' in conf and ('C FINAL' in ev_name or 'C FINAL' in round_swam_up))

                # Scoring logic check: Must be allowed by conference (based on provided rules) AND must not be time-trial/exhibition.
                is_scoring_round = any(r in round_swam_up for r in allowed) or \
                                   (is_distance and 'PRELIM' in round_swam_up and not is_c_finals_unscored)

                # Final check: Must pass all checks.
                can_score = is_scoring_round and not is_exhibition and not is_time_trial


                if can_score and scored_count < len(SCORING):
                    
                    team_name = group[0].get('team')
                    current_relays = team_scoring_metrics[team_name]['relays']
                    
                    # Check relay cap 
                    if current_relays >= max_relays:
                        for a in group:
                            a['calculated_points'] = "N/A"
                            all_calculated_athletes[f"{event}_{gender}_{a['name']}"] = a
                    else:
                        # Calculate per-swimmer points and update tracking metrics
                        team_scoring_metrics[team_name]['relays'] += 1
                        num_swimmers = grp_len 
                        
                        if half_rate_relay and num_swimmers <= 4:
                            divisor = 4.0 if num_swimmers >= 4 else num_swimmers
                            swimmer_pts = team_pts_val / divisor if divisor > 0 else 0
                        else:
                            swimmer_pts = team_pts_val / num_swimmers if num_swimmers > 0 else 0
                        
                        for a in group:
                            a['calculated_points'] = swimmer_pts
                            all_calculated_athletes[f"{event}_{gender}_{a['name']}"] = a
                    scored_count += grp_len
                else:
                    # Scoring was disallowed or cap was reached/violated
                    for a in group:
                        a['calculated_points'] = "N/A"
                        all_calculated_athletes[f"{event}_{gender}_{a['name']}"] = a

        else:
            # --- INDIVIDUAL POINT CALCULATION ---
            ev_athletes.sort(key=get_sort_key)
            scored_count = 0
            max_individuals = max_individuals_cfg
            
            i = 0
            while i < len(ev_athletes):
                # Build tie group based on rank and time
                group = [ev_athletes[i]]
                def indiv_key(a):
                    return (a.get('rank'), a.get('finals_time') or a.get('prelims_time'))
                j = i + 1
                key = indiv_key(group[0])
                while j < len(ev_athletes) and indiv_key(ev_athletes[j]) == key:
                    group.append(ev_athletes[j])
                    j += 1
                
                # The group is now correctly sized for the current rank/time block
                i = j # Move i to the start of the next unique score group

                # --- Scoring Logic Check (Individual) ---
                team_athlete = group[0] 
                is_exhibition = team_athlete.get('is_exhibition', False)
                is_time_trial = team_athlete.get('is_time_trial', False) or 'TIME TRIAL' in team_athlete.get('event', '').upper()

                conf = team_athlete.get('conference')
                allowed = allowed_rounds_for_conference(conf)
                round_swam_up = team_athlete.get('round_swam', '').upper()
                ev_name = team_athlete.get('event','').upper()
                is_distance = bool(re.search(r'\b(\d{3,})\b', ev_name)) or 'TIMED' in ev_name 

                # NSISC C Finals exclusion check: Must be scored ONLY IF (Not NSISC OR not C Final)
                is_c_finals_unscored = ('NSISC' in conf and 'C FINAL' in ev_name) or \
                                    ('NSISC' in conf and 'C FINAL' in round_swam_up)

                # Scoring logic check: Must be allowed by conference AND must not be time-trial/exhibition.
                is_scoring_round = any(r in round_swam_up for r in allowed) or \
                                   (is_distance and 'PRELIM' in round_swam_up and not is_c_finals_unscored)

                # Final check: Must pass all checks.
                can_score = is_scoring_round and not is_exhibition and not is_time_trial

                if can_score and scored_count < len(SCORING):
                    
                    team_name = group[0].get('team') # For individual events, team name might be null/same as athlete's identifier
                    current_relays = 0 # N/A for individual
                    
                    # Calculate points based on group size and scoring pool.
                    start = scored_count
                    end = min(scored_count + grp_len, len(SCORING))
                    pts_slice = SCORING[start:end]
                    
                    if pts_slice:
                        # Individual event points are assigned to each athlete in the group based on their rank/order.
                        for index, pts in enumerate(pts_slice):
                            for athlete in group:
                                athlete['calculated_points'] = pts # Assign specific point value
                        group[-1]['calculated_points'] = sum(pts_slice) # Only assign total score to the last swimmer for simple tracking if needed
                    else:
                        # No points scored, set N/A
                        for a in group:
                            a['calculated_points'] = "N/A"


                    # Update internal scoring structures (if necessary, though individual scores are usually handled by total aggregation)
                    event_data['team_scores'][team_name] += sum(pts_slice) if pts_slice else 0.0
                    scored_count += grp_len

                else:
                    # Scoring was disallowed or failed checks. Set points to N/A.
                    for a in group:
                        a['calculated_points'] = "N/A"


                i = j + 1 # Increment i for the next iteration block
                
            
    # 3. Final Assembly and Return
    return {
        'event': event, 
        'gender': gender, 
        'is_relay': is_relay, 
        'athletes_details': [a for a in ev_athletes], # Use the full list of enriched athletes
        'team_scores': dict(event_data['team_scores']) # Return as standard dictionary
    }
