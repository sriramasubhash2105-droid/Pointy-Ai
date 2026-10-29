Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WindowFinder {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public static List<string> FindWindows(uint targetPid) {
        var list = new List<string>();
        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid == targetPid) {
                var sbTitle = new StringBuilder(256);
                GetWindowText(hWnd, sbTitle, 256);
                var sbClass = new StringBuilder(256);
                GetClassName(hWnd, sbClass, 256);
                bool visible = IsWindowVisible(hWnd);
                list.Add(string.Format("hWnd: {0}, Visible: {1}, Class: {2}, Title: '{3}'", hWnd, visible, sbClass.ToString(), sbTitle.ToString()));
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }
}
"@

Write-Output "--- Apple TV (PID 56120 and 76244) ---"
[WindowFinder]::FindWindows(56120) | ForEach-Object { Write-Output "56120: $_" }
[WindowFinder]::FindWindows(76244) | ForEach-Object { Write-Output "76244: $_" }

Write-Output "--- Apple Music (PID 21996) ---"
[WindowFinder]::FindWindows(21996) | ForEach-Object { Write-Output "21996: $_" }
