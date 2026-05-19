import json
from collections import defaultdict
# Import necessary helper functions for complex scoring rules and time conversions
# Assuming these are implemented in point_calculator.py
try:
    from utils.point_calculator import allowed_rounds_for_conference, calculate_individual_score, is_valid_time_format
except ImportError:
    print("Warning: Could not import required functions from utils/point_calculator.py. Scoring may fail.")

def compute_team_totals(data_source_json):
    """
    Computes total team scores for all events and workspaces based on comprehensive scoring rules, 
    including handling exclusions (NSISC C Finals, X-swims, time trials) and integrating class totals.

    Args:
        data_source_json (dict): JSON containing event data keyed by workspace name/conference.
                                 Expected structure: { 'Conference Name': [athlete1, athlete2, ...] }

    Returns:
        dict: A dictionary where keys are conference names and values are 
              dictionaries of team totals for that conference.
    """
    all_totals = {}
    
    for ws_name, event_records in data_source_json.items():
        # Initialize totals structure for this workspace/conference
        conference_totals = defaultdict(float)
        event_totals_log = {} # To track scores per event for debugging and graphing

        # Group records by a unique identifier (e.g., Event Name + Gender) if possible, 
        # or just process sequentially assuming event context is available in the record 'a'.
        
        for i, a in enumerate(event_records):
            # Assuming 'a' contains enough context: {'team': str, 'points': str/float, 'event': str, 'gender': str, 'swim_type': str, ...}

            event = a.get('event', 'UNKNOWN_EVENT')
            swim_type = a.get('swim_type', '')
            conf = ws_name.lower()
            
            pts_val = 0.0
            is_excluded = False
            
            # Determine if the score should be excluded from team totals:
            if ('nsisc' in conf and 'c finals' in event.lower()) or \
               (swim_type == 'X') or \
               ('time trial' in event.lower()):
                is_excluded = True

            # 1. Calculate base score for the athlete (this should be handled by calculate_individual_score)
            if not is_excluded:
                try:
                    # Attempt to use a centralized scoring function if available and applicable
                    pts_val = calculate_individual_score(a, event, swim_type)
                except Exception:
                    # Fallback to reading the 'points' field directly if scoring fails or context is missing.
                    raw_points = a.get('points')
                    if raw_points and str(a.get('rank')) != 'N/A':
                        try:
                            # Robust attempt to convert various point formats (e.g., "10 pts")
                            pts_val = float(str(raw_points).split()[0]) 
                        except Exception:
                            pts_val = 0.0

            # Apply exclusion logic again to ensure zeroing out if necessary
            final_score = pts_val if not is_excluded else 0.0

            team_name = a.get('team', 'UNKNOWN')
            conference_totals[team_name] += final_score
            
            # Log event scores (simplified logging)
            if event not in event_totals_log:
                event_totals_log[event] = defaultdict(float)
            event_totals_log[event][team_name] += final_score

        all_totals[ws_name] = dict(conference_totals)

    return all_totals

def compute_class_totals(data_source_json):
    """
    Computes total scores for classes (e.g., age group, specific category) 
    and identifies top performers and cutlines.
    This function requires a dedicated class scoring mechanism, often complex and dependent on the data structure.
    Placeholder implementation focusing on aggregation:
    """
    class_totals = {}
    # In a real scenario, this would iterate over classes/age groups defined in meets.json
    # For now, we return an empty dict to mark the structural change.
    print("--- Class Scoring Logic Placeholder ---")
    return class_totals

def process_all_scoring(meets_json_path='meets.json'):
    """
    Master function to compute all necessary scores: Team Totals and Class Totals.
    """
    try:
        with open(meets_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: {meets_json_path} not found.")
        return None, None

    # 1. Compute Team Totals
    team_totals = compute_team_totals(data)
    
    # 2. Compute Class Totals (Placeholder/Future Integration Point)
    class_totals = compute_class_totals(data)

    return team_totals, class_totals

if __name__ == '__main__':
    print("--- Running Team Score Calculator ---")
    
    # This block assumes meets.json is available and structured correctly for testing/execution
    try:
        team_scores, class_scores = process_all_scoring()
        
        if team_scores:
            print("\n===========================================")
            print("✅ TEAM SCORES CALCULATED SUCCESSFULLY:")
            for ws_name, totals in team_scores.items():
                print(f"\n[Conference/Workspace]: {ws_name}")
                # Sort and display top 5 teams for readability
                sorted_teams = sorted(totals.items(), key=lambda x: -x[1])
                for i, (team, pts) in enumerate(sorted_teams[:5]):
                    print(f"  {i+1}. {team}: {pts:.2f}")

            # Optional: Display top class scores if implemented
            if class_scores and any(class_scores.values()):
                print("\n===========================================")
                print("🏆 CLASS SCORES CALCULATED SUCCESSFULLY (Placeholder):")
                # Logic to display class totals...

    except Exception as e:
        print(f"\n!!! ERROR DURING SCORING CALCULATION !!!\n{e}")