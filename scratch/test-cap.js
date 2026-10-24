const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const csCode = `
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class TestCap {
    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int w, int h, IntPtr hdcSrc, int xSrc, int ySrc, int rop);
    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hDC);
    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hDC, int w, int h);
    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hDC, IntPtr hObject);
    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hDC);
    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    public const int SRCCOPY = 0x00CC0020;
    public const int CAPTUREBLT = 0x40000000;

    public static void Main(string[] args) {
        int w = GetSystemMetrics(0); // SM_CXSCREEN
        int h = GetSystemMetrics(1); // SM_CYSCREEN
        Console.WriteLine("Screen metrics: " + w + "x" + h);

        IntPtr hdcSrc = GetDC(IntPtr.Zero);
        IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
        IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, w, h);
        IntPtr hOld = SelectObject(hdcDest, hBitmap);

        bool success = BitBlt(hdcDest, 0, 0, w, h, hdcSrc, 0, 0, SRCCOPY | CAPTUREBLT);
        int err = Marshal.GetLastWin32Error();
        Console.WriteLine("BitBlt result: " + success + " Error: " + err);

        SelectObject(hdcDest, hOld);
        DeleteDC(hdcDest);
        ReleaseDC(IntPtr.Zero, hdcSrc);

        Bitmap bmp = Image.FromHbitmap(hBitmap);
        DeleteObject(hBitmap);
        bmp.Save(args[0], ImageFormat.Jpeg);
        bmp.Dispose();
        Console.WriteLine("Saved to " + args[0]);
    }
}
`;

const csFile = path.resolve('scratch', 'test_cap.cs');
const exeFile = path.resolve('scratch', 'test_cap.exe');
const outFile = path.resolve('scratch', 'test_gdi_capture.jpg');
fs.writeFileSync(csFile, csCode);
const csc = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
cp.execSync(`"${csc}" /nologo /out:"${exeFile}" "${csFile}"`);
console.log('Compiled successfully. Running test_cap.exe...');
const out = cp.execSync(`"${exeFile}" "${outFile}"`).toString();
console.log(out);
