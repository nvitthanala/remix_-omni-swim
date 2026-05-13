# OMNI-SWIM: Matrix Suite

Professional analytics for competitive swimming. Parse results, track team standings, and simulate recruit impacts.

## 🚀 Easy Start (Windows)
We've provided two ways to launch the app:
1. **`run_local.bat`** (Recommended): Opens a technical window that shows progress. If it fails, it will tell you exactly why.
2. **`run_silent.vbs`**: Runs the app in the background. Use this once everything is working.

## 🛠️ Troubleshooting (If it won't start)
1. **Python Missing**: Download Python 3.11 from [python.org](https://www.python.org/downloads/). During installation, **MUST check the box "Add Python to PATH"**.
2. **Antivirus**: Some antivirus software blocks the "Virtual Environment" (venv) folder. If `run_local.bat` reports a failure, try moving this folder to your **Desktop** and running it from there.
3. **Internet**: You need an internet connection the **first time** you run it to download the core engines (Streamlit, etc.).

## 📁 Features
- **PDF Ingestion**: Upload Hy-Tek meet results to populate the matrix.
- **Recruit Simulation**: Inject new swimmers to see how they impact team scores.
- **Auto-Save**: All data is saved to `meets.json`. You can share this file with others to sync your data.
- **Safe Export**: Download your results as a CSV at any time from the sidebar.
