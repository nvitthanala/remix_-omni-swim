import sys
import json
import re
import pdfplumber
import difflib

def is_time(s):
    s = s.strip().rstrip('.')
    cleaned = re.sub(r'[#\*&$%^!@~]', '', s).strip()
    return bool(re.match(r'^\d*:?\d{1,2}\.\d{2}[a-zA-Z\s]*$', cleaned, re.IGNORECASE))

YEAR_PATTERN = r'\b(FR|SO|JR|SR|5Y|FY|GS|GR)\b'
AGE_PATTERN = r'\b(\d{1,2})\b'
QUALIFIER_CODES = r'(NP|NT|DQ|DFS|SCR|NS|NC\b|PROV|D2\s*[AB]|IV25|25D2)'

# Map known abbreviations to full team names
ABBREV_TEAMS = {
    "UMSL": "University of Missouri-St. Louis",
    "TRUM": "Truman State University", 
    "SBU": "Southwest Baptist University",
    "WJC": "William Jewell College",
    "MKU": "McKendree University",
    "ROCK": "University of Indianapolis",
    "MS&T": "Missouri S&T",
    "QU": "Quincy University",
    "DRURY": "Drury University",
    "DRUR": "Drury University",
    "UINDY": "University of Indianapolis",
    "INDY": "University of Indianapolis",
    "MST": "Missouri S&T",
    "LU": "Lindenwood University",
    "MARY": "University of Mary",
    "NSU": "Northern State University",
    "SCAD": "SCAD Savannah"
}


def is_data_line(stripped):
    """Check if line contains athlete data (has class year) or relay info"""
    # Hy-Tek often uses age (numeric) instead of class year; accept either
    if re.search(YEAR_PATTERN, stripped) or re.search(AGE_PATTERN, stripped):
        return True
    if re.match(r'^\d+\s', stripped) and not any(x in stripped.upper() for x in ['RECORD:', 'MEET:', 'CONF:', '-- ', 'PAGE', 'NCAA', 'HY-TEK']):
        return True
    return False


def is_stray_detail(stripped):
    """Check if line is a non-data detail line"""
    upper = stripped.upper()
    if stripped.startswith('r:') or stripped.startswith('r +'):
        return True
    if re.match(r'^\s*\d+\)\s+', stripped):
        return True
    if upper.startswith('EARLY TAKE-OFF'):
        return True
    if stripped.startswith('DQ') and not re.match(r'^\d+\s', stripped):
        return True
    # Split lines like "26.77  55.40 (55.40)"
    if re.match(r'^[\d:\.]+\s', stripped) and '(' in stripped:
        return True
    return False


def clean_school(raw):
    """Clean a school name candidate"""
    raw = re.sub(r'\s+\d+\s*$', '', raw)
    raw = re.sub(r'\s+[A-D]\s*$', '', raw)
    raw = re.sub(r'\s+' + QUALIFIER_CODES + r'\s*$', '', raw, flags=re.IGNORECASE)
    return raw.strip()


def normalize_name(name):
    name = name.strip().strip(',')
    if ', ' in name:
        parts = name.split(', ')
        name = f"{parts[1]} {parts[0]}"
    return name


def match_abbrev_team(candidate):
    """Try to match GLVC-style abbreviated team names"""
    upper = candidate.upper()
    for abbr, full in ABBREV_TEAMS.items():
        if upper.endswith(abbr) or upper == abbr:
            return full
        if abbr in upper.split():
            return full
    return None


def parse_pdf(file_path):
    with pdfplumber.open(file_path) as pdf:
        # Use non-layout mode (natural text flow)
        full_text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])

    # Detect conference heuristics (e.g., NSISC) to inform scoring rules downstream
    conference = None
    if 'NSISC' in full_text.upper():
        conference = 'NSISC'
    
    lines = full_text.split('\n')
    
    # ========== PASS 1: Discover teams ==========
    team_candidates = set()
    for line in lines:
        stripped = line.strip()
        if not stripped or len(stripped) < 8:
            continue
        
        if not is_data_line(stripped) or is_stray_detail(stripped):
            continue
        
        yr_match = re.search(YEAR_PATTERN, stripped)
        if not yr_match:
            continue
        
        upper = stripped.upper()
        if any(x in upper for x in ['RECORD:', 'MEET:', 'CONF:', 'POOL:', 'NCAA', 'HY-TEK',
                                     'SEED TIME', 'YR', 'A - FINAL', 'B - FINAL', 'C - FINAL',
                                     'PRELIMINARIES', 'FINALS', 'CHAMPION:', 'USOP', 'AMER']):
            continue
        
        after_yr = stripped[yr_match.end():].strip()
        time_match = re.search(r'\d*:?\d{1,2}\.\d{2}', after_yr)
        school_raw = after_yr[:time_match.start()].strip() if time_match else after_yr
        
        school_raw = clean_school(school_raw)
        
        # Handle GLVC format: "SeedPosition Abbreviation" e.g., "17 UMSL"
        # Remove seed position number prefix
        school_raw = re.sub(r'^\d+\s+', '', school_raw)
        
        if len(school_raw) > 2:
            # Check if it's an abbreviation
            full = match_abbrev_team(school_raw)
            if full:
                school_raw = full
            
            words = school_raw.split()
            if len(words) > 2:
                half = len(words) // 2
                if len(words) % 2 == 0 and " ".join(words[:half]) == " ".join(words[half:]):
                    school_raw = " ".join(words[:half])
            team_candidates.add(school_raw)
    
    # Add known teams
    for v in ABBREV_TEAMS.values():
        team_candidates.add(v)
    
    # Normalize candidate variants to produce a canonical team list (prefer longest descriptive form)
    canon_map = {}
    def norm_key(s):
        return re.sub(r'[^a-z0-9]', '', s.lower())

    for t in team_candidates:
        if not t: continue
        nk = norm_key(t)
        if nk not in canon_map or len(t) > len(canon_map[nk]):
            canon_map[nk] = t

    all_teams = sorted(list(canon_map.values()), key=len, reverse=True)
    
    def match_team(candidate):
        if not candidate or len(candidate) < 2:
            return None
        # First try abbreviation
        full = match_abbrev_team(candidate)
        if full:
            return full

        candidate_clean = re.sub(r'^\d+\s+', '', candidate).strip()

        # Normalize common duplicated tokens like 'University of West Florida University of'
        def normalize_team_string(s: str) -> str:
            s = re.sub(r'\s{2,}', ' ', s).strip()
            # remove trailing repeated halves: 'X Y X Y' -> 'X Y'
            parts = s.split()
            half = len(parts) // 2
            if half > 1 and len(parts) % 2 == 0 and ' '.join(parts[:half]).lower() == ' '.join(parts[half:]).lower():
                s = ' '.join(parts[:half])
            # remove common stopwords at end/start
            s = re.sub(r'\b(the|university|college|state|of)\b\s*$', '', s, flags=re.IGNORECASE).strip()
            s = re.sub(r'^\b(the|university|college|state|of)\b\s*', '', s, flags=re.IGNORECASE).strip()
            # strip trailing qualifier tokens like NT, NP, X, X0, SCR, DQ
            s = re.sub(r'\b(NT|NP|X0|X|SCR|DQ|NC|PROV|IV25|25D2|---)\b\s*$', '', s, flags=re.IGNORECASE).strip()
            # remove stray numeric-only tokens at end/start
            s = re.sub(r'^(\d+\s+)', '', s)
            s = re.sub(r'(\s+\d+)$', '', s)
            return s

        candidate_clean = normalize_team_string(candidate_clean)

        # Exact match first
        for t in all_teams:
            if candidate_clean.lower() == t.lower():
                return t

        # prefix/suffix matches
        for t in all_teams:
            if candidate_clean.lower().startswith(t.lower()) or t.lower().startswith(candidate_clean.lower()):
                return t

        # substring match
        for t in all_teams:
            if candidate_clean.lower() in t.lower() or t.lower() in candidate_clean.lower():
                return t

        # fuzzy fallback with higher cutoff to avoid bad matches
        matches = difflib.get_close_matches(candidate_clean, all_teams, n=1, cutoff=0.55)
        if matches:
            return matches[0]
        return None
    
    # ========== PASS 2: Parse athletes ==========
    athletes = {}
    current_event = None
    current_gender = None
    current_round = "Finals"
    current_event_is_time_trial = False
    
    for line_idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        
        upper = stripped.upper()
        
        # Event headers
        event_match = re.match(r'^Event\s+(\d+)\s+(Men|Women|Boys?|Girls?|Mixed|Coed|Men\'s|Women\'s)[\'sS]?\s+(.*)', stripped, re.IGNORECASE)
        if event_match:
            event_num = int(event_match.group(1))
            gender_str = event_match.group(2).lower()
            current_gender = "Women" if any(x in gender_str for x in ["women", "girls"]) else "Men"
            event_name = event_match.group(3).strip()
            current_event = f"Event {event_num} {current_gender} {event_name}"
            current_event_is_time_trial = 'TIME TRIAL' in event_name.upper()
            current_round = "Time Trial" if current_event_is_time_trial else "Finals"
            continue
        
        if not current_event:
            continue
        
        # Round changes
        if upper.startswith('PRELIMINARIES') or upper == 'PRELIMS':
            current_round = "Preliminaries"
            continue
        if 'A - FINAL' in upper or upper == 'A FINAL' or 'CHAMPIONSHIP FINAL' in upper:
            current_round = "A Final"
            continue
        if 'B - FINAL' in upper or upper == 'B FINAL' or 'CONSOLATION FINAL' in upper:
            current_round = "B Final"
            continue
        if 'C - FINAL' in upper or upper == 'C FINAL' or 'BONUS FINAL' in upper:
            current_round = "C Final"
            continue
        if 'D - FINAL' in upper or upper == 'D FINAL':
            current_round = "D Final"
            continue
        
        # Skip non-data
        skip_flags = ['RECORD:', 'MEET:', 'CONF:', 'POOL:', 'NCAA', 'HY-TEK',
                      'SEED TIME', '-- ', 'PAGE', 'EARLY TAKE-OFF',
                      'CONSIDERATION', 'AUTOMATIC QUAL', 'CHAMPION:',
                      'USOP', 'AMER', "'25 CHAMPION", 'TEAM RELAY',
                      'PROV ', 'IV25', 'NC ']
        if any(x in upper for x in skip_flags):
            continue
        if re.match(r'^Name\s+Yr\s+School', upper) or ('YR' in upper and 'SCHOOL' in upper):
            continue
        if re.match(r'^Team\s+Relay', upper) or upper.startswith('TEAM RELAY'):
            continue
        if 'FINALS' in upper and 'PRELIM' in upper and 'SCORE' in upper:
            continue
        
        if is_stray_detail(stripped):
            continue
        
        is_relay = "relay" in current_event.lower()
        
        # ===== RELAYS =====
        if is_relay:
            rank_match = re.match(r'^(\d+|---)\s+', stripped)
            if not rank_match:
                continue
            
            rest = stripped[rank_match.end():].strip()
            is_exhibition = rank_match.group(1) == '---'
            
            time_positions = [(m.start(), m.end()) for m in re.finditer(r'\d*:?\d{1,2}\.\d{2}', rest)]
            if not time_positions:
                continue
            
            first_time_pos = time_positions[0][0]
            school_raw = clean_school(rest[:first_time_pos].strip())
            school_raw = re.sub(r'^\d+\s+', '', school_raw)  # Remove seed position
            
            school = match_team(school_raw)
            if not school:
                continue
            
            times = [rest[s:e] for s, e in time_positions]
            finals_time = times[-1] if len(times) >= 2 else (times[0] if times else None)
            
            # Points
            points = None
            after_times = rest[time_positions[-1][1]:].strip()
            pts_match = re.search(r'\b(\d{1,3})\s*$', after_times)
            if pts_match:
                val = int(pts_match.group(1))
                if 1 <= val <= 200:
                    points = val
            
            if not points:
                after_school = rest[len(school_raw) + 1:] if school_raw else rest
                for w in after_school.split():
                    m = re.match(r'^(\d{1,3})$', w)
                    if m:
                        val = int(m.group(1))
                        if 1 <= val <= 200:
                            points = val
                            break
            
            # Relay swimmers
            relay_names = []
            for j in range(line_idx + 1, min(len(lines), line_idx + 10)):
                nxt = lines[j].strip()
                if not nxt:
                    continue
                swimmers = re.findall(r'(\d+)\)\s*([A-Za-z\-\',\.\s]+?)\s+(FR|SO|JR|SR|5Y|FY|GS|GR)', nxt)
                if swimmers:
                    for num, sname, syear in swimmers:
                        sname = normalize_name(sname)
                        relay_names.append({"name": sname, "year": syear.upper()})
                elif re.match(r'^[\d:\.]+\s', nxt) and '(' in nxt:
                    continue
                elif nxt.startswith('r:') or nxt.startswith('DQ') or nxt.upper().startswith('EARLY TAKE-OFF'):
                    continue
                elif re.match(r'^\d+\)', nxt):
                    single = re.search(r'(\d+)\)\s+([A-Za-z\-\',\.\s]+)', nxt)
                    if single:
                        sname = normalize_name(single.group(2))
                        yr_m = re.search(YEAR_PATTERN, sname)
                        syear = yr_m.group(1) if yr_m else "UNKNOWN"
                        if yr_m:
                            sname = re.sub(YEAR_PATTERN, '', sname).strip()
                        relay_names.append({"name": sname, "year": syear.upper()})
                else:
                    break
            
            if relay_names:
                key = (school, current_event, current_gender)
                if key not in athletes:
                    athletes[key] = {
                        "name": school, "event": current_event, "gender": current_gender,
                        "team": school, "year": "UNKNOWN", "is_relay": True,
                        "prelims_time": None, "finals_time": finals_time,
                        "round_swam": current_round, "is_exhibition": is_exhibition,
                        "is_time_trial": current_event_is_time_trial,
                        "rank": rank_match.group(1) if rank_match.group(1) != '---' else None,
                        "points": points or 0, "relay_names": relay_names,
                        "conference": conference
                    }
            continue
        
        # ===== INDIVIDUAL =====
            # Try Hy-Tek style single-line parsing: Place Name Age TEAM Seed Final [Std]
            hytek_re = re.compile(r'^(?P<place>\d+|X|#|---)?\s*(?P<name>[A-Za-z\-\']+,\s*[A-Za-z\.\-\s]+)\s+(?P<age>\d{1,2})\s+(?P<team>[A-Za-z0-9\-\&\.]{2,})\s*(?P<rest>.*)$')
            m = hytek_re.match(stripped)
            if m:
                rank = None
                is_exhibition = False
                place_tok = m.group('place')
                if place_tok in ('X', '#', '---'):
                    is_exhibition = True
                elif place_tok and place_tok.isdigit():
                    rank = place_tok

                name = normalize_name(m.group('name'))
                yr = 'UNKNOWN'
                age = m.group('age')
                school_raw = m.group('team')
                rest = m.group('rest')

                # Extract times and possible points from rest
                time_match = re.search(r'(\d*:?\d{1,2}\.\d{2}|NT|DQ)', rest)
                if time_match:
                    finals_time = time_match.group(1)
                    after = rest[time_match.end():].strip()
                else:
                    finals_time = None
                    after = rest

                school = match_team(clean_school(school_raw))
                if not school:
                    # fallback to existing logic if team not matched
                    school = match_team(school_raw)

                if not school:
                    continue

                key = (name, current_event, current_gender)
                if key not in athletes:
                    athletes[key] = {
                        "name": name, "event": current_event, "gender": current_gender,
                        "team": school, "year": yr, "is_relay": False,
                        "prelims_time": None, "finals_time": finals_time,
                        "round_swam": current_round, "is_exhibition": is_exhibition,
                        "is_time_trial": current_event_is_time_trial, "rank": rank if rank and rank != '---' else None,
                        "points": None,
                        "conference": conference
                    }
                else:
                    ath = athletes[key]
                    if finals_time:
                        ath['finals_time'] = finals_time
                continue

            # Fallback: original year-based parsing
            yr_match = re.search(YEAR_PATTERN, stripped)
            if not yr_match:
                continue

            yr = yr_match.group(1).upper()
            before_yr = stripped[:yr_match.start()].strip()
            after_yr = stripped[yr_match.end():].strip()

            rank = None
            is_exhibition = False
            name_raw = before_yr

            rank_exh = re.match(r'^(\d+|---)\s+(.*)', before_yr)
            if rank_exh:
                if rank_exh.group(1) == '---':
                    is_exhibition = True
                else:
                    rank = rank_exh.group(1)
                name_raw = rank_exh.group(2).strip()

            if not name_raw:
                continue

            name = normalize_name(name_raw)

            # After year: School [Times...]
            time_match = re.search(r'(\d*:?\d{1,2}\.\d{2})', after_yr)
            if time_match:
                school_raw = clean_school(after_yr[:time_match.start()].strip())
                rest = after_yr[time_match.start():].strip()
            else:
                school_raw = clean_school(after_yr)
                rest = ''
        
        # Handle GLVC: "17 UMSL" -> remove seed position before team
        school_raw = re.sub(r'^\d+\s+', '', school_raw)
        
        school = match_team(school_raw)
        if not school:
            # Try finding abbreviation in the school_raw text
            words = school_raw.split()
            for i, w in enumerate(words):
                full = match_abbrev_team(w.upper())
                if full:
                    school = full
                    break
        if not school:
            continue
        
        # Parse times/points from rest
        rest_clean = re.sub(r'\s+(q|IV25|D2\s+[AB]|NC\b|PROV|25D2|#|\*|&|\$|%|\^|!|@)\s*', ' ', rest, flags=re.IGNORECASE).strip()
        tokens = rest_clean.split()
        
        times = []
        points = None
        
        for token in tokens:
            token = token.strip()
            if not token:
                continue
            if is_time(token):
                times.append(token)
            elif token.upper() in ['DQ', 'DFS', 'SCR', 'NS', 'NT']:
                times.append(token.upper())
            elif token.startswith('X') and is_time(token[1:]):
                is_exhibition = True
                times.append(token[1:])
            elif token in ['NP', 'X']:
                continue
            elif token == '-' or token.startswith('---'):
                continue
            else:
                m = re.match(r'^(\d{1,3})$', token)
                if m:
                    val = int(m.group(1))
                    if points is None:
                        points = val
        
        if not times:
            continue
        
        is_prelim = current_round == "Preliminaries"
        if is_prelim:
            prelims_time = times[-1] if times else None
            finals_time = None
        else:
            if len(times) >= 2:
                prelims_time = times[0]
                finals_time = times[-1]
            elif len(times) == 1:
                prelims_time = None
                finals_time = times[0]
            else:
                prelims_time = None
                finals_time = None
        
        # Defensive: if parser didn't set a name for this line, skip
        if 'name' not in locals() or not name:
            continue
        key = (name, current_event, current_gender)
        if key not in athletes:
            athletes[key] = {
                "name": name, "event": current_event, "gender": current_gender,
                "team": school, "year": yr, "is_relay": False,
                "prelims_time": prelims_time, "finals_time": finals_time,
                "round_swam": current_round, "is_exhibition": is_exhibition,
                "is_time_trial": current_event_is_time_trial, "rank": rank if rank and rank != '---' else None,
                "points": points or 0,
                "conference": conference
            }
        else:
            ath = athletes[key]
            if not ath.get("prelims_time") and prelims_time:
                ath["prelims_time"] = prelims_time
            if finals_time:
                ath["finals_time"] = finals_time
            if points:
                ath["points"] = points
            if is_exhibition:
                ath["is_exhibition"] = True
            if rank and rank != '---' and not ath.get("rank"):
                ath["rank"] = rank
            if ath["round_swam"] == "Preliminaries" and current_round != "Preliminaries":
                ath["round_swam"] = current_round
    
    # ========== BUILD RESULTS ==========
    results = []
    for key, data in athletes.items():
        if all_teams and data["team"] not in all_teams:
            continue
        
        if data["is_relay"] and data.get("relay_names"):
            for r in data["relay_names"]:
                results.append({
                    "name": r["name"], "event": data["event"], "gender": data["gender"],
                    "team": data["team"], "year": r["year"], "is_relay": True,
                    "prelims_time": data["prelims_time"], "finals_time": data["finals_time"],
                    "round_swam": data["round_swam"], "is_exhibition": data["is_exhibition"],
                    "is_time_trial": data.get("is_time_trial", False),
                    "rank": data.get("rank"), "extracted_points": data["points"],
                    "conference": data.get("conference")
                })
        else:
            results.append({
                "name": data["name"], "event": data["event"], "gender": data["gender"],
                "team": data["team"], "year": data["year"], "is_relay": False,
                "prelims_time": data["prelims_time"], "finals_time": data["finals_time"],
                "round_swam": data["round_swam"], "is_exhibition": data["is_exhibition"],
                "is_time_trial": data.get("is_time_trial", False),
                "rank": data.get("rank"), "extracted_points": data["points"],
                "conference": data.get("conference")
            })
    
    print(json.dumps(results))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
    parse_pdf(sys.argv[1])