using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Tico.App.Helpers;

public static class CursorHelper
{
    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X, Y; }

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, char[] lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    public static (int X, int Y) GetCursorPosition()
    {
        GetCursorPos(out POINT pt);
        return (pt.X, pt.Y);
    }

    public static (string Title, string ProcessName, int Left, int Top, int Width, int Height) GetActiveWindowInfo()
    {
        var hwnd = GetForegroundWindow();
        var titleBuf = new char[256];
        int len = GetWindowText(hwnd, titleBuf, titleBuf.Length);
        var title = new string(titleBuf, 0, len);

        GetWindowThreadProcessId(hwnd, out uint pid);
        string processName;
        try { processName = Process.GetProcessById((int)pid).ProcessName; }
        catch { processName = "unknown"; }

        GetWindowRect(hwnd, out RECT rect);
        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;

        return (title, processName, rect.Left, rect.Top, width, height);
    }
}
