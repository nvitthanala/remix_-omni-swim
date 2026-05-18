@echo off
cd /d "C:\Users\nihar\Desktop\remix_-omni-swim"

echo ========================================
echo Running all PDF parser tests
echo ========================================

venv/Scripts/python.exe pdf_parser.py "2026_acc_championship_full_meet_results_1col.pdf" > test_suite/test_acc_output.json 2>&1
echo ACC test saved to test_suite/test_acc_output.json

venv/Scripts/python.exe pdf_parser.py "2026_NSISC_Championships_Final_Results.pdf" > test_suite/test_nsisc_output.json 2>&1
echo NSISC test saved to test_suite/test_nsisc_output.json

venv/Scripts/python.exe pdf_parser.py "glvc_results26.pdf" > test_suite/test_glvc_output.json 2>&1
echo GLVC test saved to test_suite/test_glvc_output.json

venv/Scripts/python.exe pdf_parser.py "Big_12_S_D_Champ_Results_pdf.pdf" > test_suite/test_big12_output.json 2>&1
echo Big12 test saved to test_suite/test_big12_output.json

echo.
echo All tests complete!
echo.
pause