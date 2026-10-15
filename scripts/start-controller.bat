@echo off
setlocal
set "ROOT=C:\Users\nook\Documents\GitHub\tapo-l630-controller"
set "PYTHON=C:\Users\nook\AppData\Local\Programs\Python\Python314\python.exe"
set "LOGDIR=%LOCALAPPDATA%\TapoL630"
set "LOG=%LOGDIR%\controller.log"

if not exist "%LOGDIR%" mkdir "%LOGDIR%"
cd /d "%ROOT%"

>>"%LOG%" echo.
>>"%LOG%" echo ---- %DATE% %TIME% start ----
set PYTHONUNBUFFERED=1
"%PYTHON%" -u -m uvicorn app:app --host 127.0.0.1 --port 8000 >>"%LOG%" 2>&1
exit /b %ERRORLEVEL%
