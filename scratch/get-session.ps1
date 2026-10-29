Get-Process -Name AppleMusic, AppleTV -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, SessionId
