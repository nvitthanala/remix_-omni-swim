import difflib
teams = [
  'University of West Florida University of West Florida',
  'Delta State University Delta State University',
  'Ouachita Baptist University Ouachita Baptist University',
  'Henderson State University Henderson State University'
]
print(difflib.get_close_matches("Delta State University", teams, n=1, cutoff=0.3))
