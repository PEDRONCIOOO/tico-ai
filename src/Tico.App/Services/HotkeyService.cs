using System.Runtime.InteropServices;
using System.Windows.Input;
using System.Windows.Interop;

namespace Tico.App.Services;

public class HotkeyService : IHotkeyService
{
    private HwndSource? _hwndSource;
    private int _targetVk;
    private uint _modFlags;
    private volatile bool _isPressed;

    public event Action? HotkeyDown;
    public event Action? HotkeyUp;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    private const int HOTKEY_ID = 1;
    private const int WM_HOTKEY = 0x0312;
    private const uint MOD_ALT = 0x0001;
    private const uint MOD_CONTROL = 0x0002;
    private const uint MOD_SHIFT = 0x0004;
    private const uint MOD_NOREPEAT = 0x4000;

    public void Start(string hotkeyCombo)
    {
        ParseHotkeyCombo(hotkeyCombo);

        var parameters = new HwndSourceParameters("TicoHotkey") { Width = 0, Height = 0, WindowStyle = 0 };
        _hwndSource = new HwndSource(parameters);
        _hwndSource.AddHook(WndProc);

        RegisterHotKey(_hwndSource.Handle, HOTKEY_ID, _modFlags | MOD_NOREPEAT, (uint)_targetVk);
    }

    public void Stop()
    {
        if (_hwndSource != null)
        {
            UnregisterHotKey(_hwndSource.Handle, HOTKEY_ID);
            _hwndSource.RemoveHook(WndProc);
            _hwndSource.Dispose();
            _hwndSource = null;
        }
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WM_HOTKEY && wParam.ToInt32() == HOTKEY_ID && !_isPressed)
        {
            _isPressed = true;
            HotkeyDown?.Invoke();
            handled = true;

            var vk = _targetVk;
            Task.Run(() => PollKeyRelease(vk));
        }
        return IntPtr.Zero;
    }

    private void PollKeyRelease(int vk)
    {
        while ((GetAsyncKeyState(vk) & 0x8000) != 0)
            Thread.Sleep(15);

        _isPressed = false;
        System.Windows.Application.Current?.Dispatcher.BeginInvoke(() => HotkeyUp?.Invoke());
    }

    private void ParseHotkeyCombo(string combo)
    {
        _modFlags = 0;
        var parts = combo.Split('+').Select(p => p.Trim()).ToList();
        foreach (var part in parts)
        {
            switch (part.ToLower())
            {
                case "ctrl": _modFlags |= MOD_CONTROL; break;
                case "shift": _modFlags |= MOD_SHIFT; break;
                case "alt": _modFlags |= MOD_ALT; break;
                default:
                    if (Enum.TryParse<Key>(part, true, out var key))
                        _targetVk = KeyInterop.VirtualKeyFromKey(key);
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
