@echo off
rem Starts the Memoria sync agent and appends its output to a log file.
rem Task Scheduler runs this at login (see apps/agent/README.md).
cd /d "%~dp0.."
if not exist "%LOCALAPPDATA%\Memoria" mkdir "%LOCALAPPDATA%\Memoria"
node src\index.ts >> "%LOCALAPPDATA%\Memoria\agent.log" 2>&1
