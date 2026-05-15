using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Input;

namespace Tico.App.Services;

public class HotkeyService : IHotkeyService
{
    private IntPtr _hookId = IntPtr.Zero;
    private LowLevelKeyboardProc? _hookProc;
    private Key _targetKey = Key.Space;
    private ModifierKeys _targetModifiers = ModifierKeys.Control | ModifierKeys.Shift;
    private bool _isPressed;

    public event Action? HotkeyDown;
    public event Action? HotkeyUp;

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_SYSKEYUP = 0x0105;

    public void Start(string hotkeyCombo)
    {
        ParseHotkeyCombo(hotkeyCombo);
        _hookProc = HookCallback;
        using var process = Process.GetCurrentProcess();
        using var module = process.MainModule!;
        _hookId = SetWindowsHookEx(WH_KEYBOARD_LL, _hookProc, GetModuleHandle(module.ModuleName!), 0);
    }

    public void Stop()
    {
        if (_hookId != IntPtr.Zero)
        {
            UnhookWindowsHookEx(_hookId);
            _hookId = IntPtr.Zero;
        }
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int vkCode = Marshal.ReadInt32(lParam);
            var key = KeyInterop.KeyFromVirtualKey(vkCode);
            bool isDown = wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN;
            bool isUp = wParam == WM_KEYUP || wParam == WM_SYSKEYUP;

            if (key == _targetKey)
            {
                if (isDown && !_isPressed && AreModifiersHeld())
                {
                    _isPressed = true;
                    System.Windows.Application.Current?.Dispatcher.BeginInvoke(() => HotkeyDown?.Invoke());
                }
                else if (isUp && _isPressed)
                {
                    _isPressed = false;
                    System.Windows.Application.Current?.Dispatcher.BeginInvoke(() => HotkeyUp?.Invoke());
                }
            }
        }
        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    private bool AreModifiersHeld()
    {
        if (_targetModifiers.HasFlag(ModifierKeys.Control) && !IsKeyDown(0x11)) return false;
        if (_targetModifiers.HasFlag(ModifierKeys.Shift) && !IsKeyDown(0x10)) return false;
        if (_targetModifiers.HasFlag(ModifierKeys.Alt) && !IsKeyDown(0x12)) return false;
        return true;
    }

    private static bool IsKeyDown(int vKey) => (GetAsyncKeyState(vKey) & 0x8000) != 0;

    private void ParseHotkeyCombo(string combo)
    {
        _targetModifiers = ModifierKeys.None;
        var parts = combo.Split('+').Select(p => p.Trim()).ToList();
        foreach (var part in parts)
        {
            switch (part.ToLower())
            {
                case "ctrl": _targetModifiers |= ModifierKeys.Control; break;
                case "shift": _targetModifiers |= ModifierKeys.Shift; break;
                case "alt": _targetModifiers |= ModifierKeys.Alt; break;
                default:
                    if (Enum.TryParse<Key>(part, true, out var key))
                        _targetKey = key;
                    break;
            }
        }
    }

    public void Dispose()
    {
        Stop();
        GC.SuppressFinalize(this);
    }
}
