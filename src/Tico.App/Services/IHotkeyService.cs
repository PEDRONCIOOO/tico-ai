namespace Tico.App.Services;

public interface IHotkeyService : IDisposable
{
    event Action? HotkeyDown;
    event Action? HotkeyUp;
    void Start(string hotkeyCombo);
    void Stop();
}
