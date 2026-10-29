$p = Get-Process -Name AppleMusic -ErrorAction SilentlyContinue
Write-Output "AppleMusic PID: $($p.Id), MainWindowHandle: $($p.MainWindowHandle)"
if ($p.MainWindowHandle -ne 0) {
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    using System.Text;
    public class WinInfo {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);
        public static string Get(IntPtr hWnd) {
            var t = new StringBuilder(256);
            GetWindowText(hWnd, t, 256);
            var c = new StringBuilder(256);
            GetClassName(hWnd, c, 256);
            return "Visible: " + IsWindowVisible(hWnd) + ", Class: " + c.ToString() + ", Title: '" + t.ToString() + "'";
        }
    }
"@
    Write-Output ([WinInfo]::Get([IntPtr]$p.MainWindowHandle))
}
