# Pointy AI - UI Automation Element Scanner
# Scans the foreground window's UI tree for interactive elements

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# Get the foreground window handle
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

$hwnd = [WinAPI]::GetForegroundWindow()
$rect = New-Object WinAPI+RECT
[WinAPI]::GetWindowRect($hwnd, [ref]$rect) | Out-Null

# Get window title
$sb = New-Object System.Text.StringBuilder(256)
[WinAPI]::GetWindowText($hwnd, $sb, 256) | Out-Null
$windowTitle = $sb.ToString()

try {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
} catch {
    Write-Output '{"window":{"role":"window","label":"Unknown","x":0,"y":0,"w":0,"h":0},"elements":[]}'
    exit
}

if ($null -eq $root) {
    Write-Output '{"window":{"role":"window","label":"Unknown","x":0,"y":0,"w":0,"h":0},"elements":[]}'
    exit
}

# Build conditions for interactive elements
$conditions = @(
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Button),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Hyperlink),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Edit),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::MenuItem),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Tab),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::TabItem),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::CheckBox),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::ComboBox),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::ListItem),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Text),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::RadioButton),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Slider),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::TreeItem)
)

$orCondition = New-Object System.Windows.Automation.OrCondition($conditions)

# Walk descendants
$elements = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $orCondition)

$results = [System.Collections.ArrayList]@()
$count = 0
$maxElements = 300

foreach ($el in $elements) {
    if ($count -ge $maxElements) { break }
    
    try {
        $name = $el.Current.Name
        $ctrlType = $el.Current.ControlType.ProgrammaticName -replace "ControlType\.", ""
        
        # Skip elements without useful names
        if ([string]::IsNullOrWhiteSpace($name)) { continue }
        
        # Skip password fields
        if ($ctrlType -eq "Edit" -and $el.Current.IsPassword) { continue }
        
        # Get bounding rectangle
        $bounds = $el.Current.BoundingRectangle
        if ($bounds.IsEmpty) { continue }
        if ($bounds.Width -lt 4 -or $bounds.Height -lt 4) { continue }
        
        # Skip offscreen elements
        if ($bounds.Right -lt 0 -or $bounds.Bottom -lt 0) { continue }
        if ($bounds.Left -gt 3840 -or $bounds.Top -gt 2160) { continue }
        
        $trimmedName = $name
        if ($trimmedName.Length -gt 80) {
            $trimmedName = $trimmedName.Substring(0, 80)
        }
        
        $obj = @{
            role = $ctrlType.ToLower()
            label = $trimmedName
            x = [int]$bounds.X
            y = [int]$bounds.Y
            w = [int]$bounds.Width
            h = [int]$bounds.Height
        }
        $results.Add($obj) | Out-Null
        $count++
    } catch {
        continue
    }
}

$windowObj = @{
    role = "window"
    label = $windowTitle
    x = $rect.Left
    y = $rect.Top
    w = ($rect.Right - $rect.Left)
    h = ($rect.Bottom - $rect.Top)
}

$output = @{
    window = $windowObj
    elements = $results.ToArray()
}

$output | ConvertTo-Json -Depth 3 -Compress
