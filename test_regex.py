import re
text = "1 University of West Florida 1,239\tUniversity of West Florida"
print(re.findall(r'(?:^|\s)\d+\.?\s+([A-Za-z\s\-\'&\.,\(\)]+?)\s+\d+(?:,\d{3})*(?:\.\d+)?(?:$|\s)', text))
