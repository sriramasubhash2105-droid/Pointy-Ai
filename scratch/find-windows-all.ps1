Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WindowFinder2 {
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

    public static List<string> FindAllWindows() {
        var list = new List<string>();
        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            var sbTitle = new StringBuilder(256);
            GetWindowText(hWnd, sbTitle, 256);
            var sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);
            string title = sbTitle.ToString();
            string className = sbClass.ToString();
            if (title.IndexOf("Apple", StringComparison.OrdinalIgnoreCase) >= 0 ||
                title.IndexOf("TV", StringComparison.OrdinalIgnoreCase) >= 0 ||
                className.IndexOf("Apple", StringComparison.OrdinalIgnoreCase) >= 0) {
                bool visible = IsWindowVisible(hWnd);
                list.Add(string.Format("PID: {0}, hWnd: {1}, Visible: {2}, Class: {3}, Title: '{4}'", pid, hWnd, visible, className, title));
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }
}
"@

[WindowFinder2]::FindAllWindows() | ForEach-Object { Write-Output $_ }
