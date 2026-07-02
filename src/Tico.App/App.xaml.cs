using System.Net.Http;
using System.Threading;
using System.Windows;
using NAudio.Wave;
using Tico.App.Config;
using Tico.App.Core;
using Tico.App.Helpers;
using Tico.App.Services;
using Tico.App.UI;

namespace Tico.App;

public partial class App : Application
{
    private static Mutex? _mutex;
    private TrayIconManager? _tray;
    private HotkeyService? _hotkey;
    private CompanionManager? _manager;
    private OverlayWindow? _overlay;
    private BuddyCursorWindow? _buddy;
    private AppSettings? _settings;
    private SessionManager? _sessionManager;
    private AuthService? _auth;
    private ProxyClient? _proxy;
    private ChatHistoryStore? _chatStore;
    private ChatHistoryButton? _chatButton;
    private SettingsWindow? _settingsWindow;
    private ChatHistoryWindow? _chatWindow;

    protected override void OnStartup(StartupEventArgs e)
    {
        const string mutexName = "Tico_SingleInstance";
        _mutex = new Mutex(true, mutexName, out bool isNewInstance);

        if (!isNewInstance)
        {
            MessageBox.Show("Tico já está rodando.", "Tico", MessageBoxButton.OK);
            Shutdown();
            return;
        }

        base.OnStartup(e);
        try
        {
            Initialize();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Erro ao iniciar Tico:\n\n{ex}", "Tico — Erro", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown();
        }
    }

    private void Initialize()
    {
        _settings = AppSettings.LoadFrom(AppSettings.DefaultPath);

        var http = new HttpClient();
        _auth = new AuthService(http, _settings);
        var tokenStore = new TokenStore();
        _sessionManager = new SessionManager(_auth, tokenStore);

        // Auth gate: if no valid session, show login modal before initializing the rest.
        if (!EnsureLoggedIn())
        {
            Shutdown();
            return;
        }

        _proxy = new ProxyClient(http, _settings, _sessionManager);
        var omniParser = !string.IsNullOrEmpty(_settings.OmniParserUrl)
            ? new OmniParserClient(http, _settings)
            : null;
        var audio = new AudioCaptureService();
        audio.DeviceNumber = ResolveDeviceNumber(_settings.MicrophoneDevice);
        var screen = new ScreenCaptureService();

        _manager = new CompanionManager(audio, screen, _proxy, _settings, omniParser);

        _chatStore = new ChatHistoryStore();

        _tray = new TrayIconManager();
        _overlay = new OverlayWindow();
        _buddy = new BuddyCursorWindow();
        _buddy.SetIconStyle(_settings.IconStyle);
        _buddy.ShowBuddy();

        if (_settings.FirstRunCompleted)
        {
            var name = _sessionManager.Current?.Email.Split('@')[0];
            _buddy.ShowWelcomeMessage($"oi, {name}!");
        }
        else
        {
            _buddy.ShowWelcomeMessage();
        }

        // Chat history button + window
        if (_settings.ChatHistoryEnabled)
        {
            _chatButton = new ChatHistoryButton();
            _chatWindow = new ChatHistoryWindow(_chatStore);

            _chatButton.Clicked += () =>
            {
                Dispatcher.Invoke(() =>
                {
                    if (_chatWindow.IsVisible)
                        _chatWindow.Hide();
                    else
                        _chatWindow.Show();
                });
            };

            _chatButton.PauseClicked += () =>
            {
                if (_chatButton.IsPaused)
                    AudioHelper.PausePlayback();
                else
                    AudioHelper.ResumePlayback();
            };
        }

        // State changes update tray icon and buddy visuals
        _manager.StateChanged += state =>
        {
            Dispatcher.Invoke(() =>
            {
                _buddy?.UpdateState(state);
                _tray.UpdateState(state);

                switch (state)
                {
                    case CompanionState.Idle:
                        _buddy?.FadeOutIfTransient();
                        break;
                }
            });
        };

        // Pointing: buddy flies to target + overlay shows glow
        _manager.PointAtElement += (screenX, screenY, bubbleText) =>
        {
            Dispatcher.Invoke(() =>
            {
                _buddy?.AnimateToTarget(screenX, screenY, bubbleText);
                _overlay?.ShowGlowAt((int)screenX, (int)screenY);
            });
        };

        // Return to cursor: buddy follows cursor again + overlay dismisses
        _manager.ReturnToCursor += () =>
        {
            Dispatcher.Invoke(() =>
            {
                _buddy?.FollowCursor();
                _overlay?.DismissWithFade();
            });
        };

        // Dismiss overlay (e.g., when user interrupts with new recording)
        _manager.DismissOverlay += () =>
        {
            Dispatcher.Invoke(() =>
            {
                _overlay?.DismissWithFade();
                AudioHelper.StopPlayback();
            });
        };

        // Show a short bubble message on the buddy (e.g. usage limit reached)
        _manager.ShowMessage += message =>
        {
            Dispatcher.Invoke(() =>
            {
                _buddy?.ShowTransiently();
                _buddy?.ShowSpeechBubble(message);
            });
        };

        // Audio power feeds the buddy waveform during recording.
        // Called from the NAudio worker thread — no Dispatcher (would block the audio
        // thread); SetAudioPower just writes a double field, atomic on x64.
        _manager.AudioPowerUpdated += power => _buddy?.SetAudioPower(power);

        _manager.ChatEntryCompleted += (question, response) =>
        {
            if (!_settings.ChatHistoryEnabled) return;
            Dispatcher.Invoke(() =>
            {
                _chatStore?.AddEntry(question, response);
                _chatButton?.ShowWithFade();
                _chatButton?.IncrementCount();
            });
        };

        // Hotkey events
        _hotkey = new HotkeyService();
        _hotkey.HotkeyDown += () =>
        {
            _buddy?.ShowTransiently();
            _chatButton?.ResetPause();
            _manager.OnHotkeyDown();
        };
        _hotkey.HotkeyUp += () => _ = _manager.OnHotkeyUpAsync();
        _hotkey.Start(_settings.HotkeyCombo);

        // Create persistent settings window (starts minimized in taskbar)
        _settingsWindow = new SettingsWindow(_settings, _sessionManager.Current!, _proxy);
        _settingsWindow.WindowState = WindowState.Minimized;
        _settingsWindow.Show();

        _settingsWindow.IconStyleChanged += style =>
        {
            _buddy?.SetIconStyle(style);
        };
        _settingsWindow.MicrophoneChanged += deviceNumber =>
        {
            audio.DeviceNumber = deviceNumber;
        };
        _settingsWindow.BuddyVisibilityChanged += visible =>
        {
            _buddy?.SetTransientMode(!visible);
        };
        _settingsWindow.HotkeyChanged += combo =>
        {
            _hotkey?.Dispose();
            _hotkey = new HotkeyService();
            _hotkey.HotkeyDown += () =>
            {
                _buddy?.ShowTransiently();
                _manager!.OnHotkeyDown();
            };
            _hotkey.HotkeyUp += () => _ = _manager!.OnHotkeyUpAsync();
            _hotkey.Start(combo);
        };
        _settingsWindow.ChatHistoryVisibilityChanged += enabled =>
        {
            if (enabled)
            {
                if (_chatButton == null)
                {
                    _chatButton = new ChatHistoryButton();
                    _chatButton.Clicked += () => Dispatcher.Invoke(() =>
                    {
                        if (_chatWindow == null)
                            _chatWindow = new ChatHistoryWindow(_chatStore!);
                        if (_chatWindow.IsVisible) _chatWindow.Hide();
                        else _chatWindow.Show();
                    });
                }
                if (_chatStore!.Entries.Count > 0)
                    _chatButton.ShowWithFade();
            }
            else
            {
                _chatButton?.HideWithFade();
                _chatWindow?.Hide();
            }
        };
        _settingsWindow.LogoutRequested += async () =>
        {
            await _sessionManager.LogoutAsync();
            MessageBox.Show(
                "Sessão encerrada. Abra o Tico novamente para entrar.",
                "Tico", MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown();
        };

        // Tray events
        _tray.SettingsRequested += () =>
        {
            _settingsWindow?.ShowFromTaskbar();
        };

        _tray.QuitRequested += () =>
        {
            _settingsWindow?.ForceClose();
            _buddy?.HideBuddy();
            _hotkey.Dispose();
            _tray.Dispose();
            audio.Dispose();
            Shutdown();
        };

        // TLS warmup — pre-warm connection to proxy
        _ = Task.Run(async () =>
        {
            try
            {
                using var warmupClient = new HttpClient();
                await warmupClient.SendAsync(new HttpRequestMessage(
                    HttpMethod.Head, _settings.ProxyBaseUrl));
            }
            catch { /* ignore warmup failures */ }
        });

        // Mark first run as completed
        if (!_settings.FirstRunCompleted)
        {
            _settings.FirstRunCompleted = true;
            _settings.SaveTo(AppSettings.DefaultPath);
        }

        // Update check — runs in background, notifies user if new version available
        _ = Task.Run(async () =>
        {
            await Task.Delay(3000);
            var update = await UpdateChecker.CheckAsync(http);
            if (update != null)
            {
                Dispatcher.Invoke(() =>
                {
                    _buddy?.ShowTransiently();
                    _buddy?.ShowSpeechBubble($"nova versão {update.Version} disponível!");
                    _tray?.ShowUpdateNotification(update.Version, update.Url);
                });
            }
        });
    }

    /// <summary>
    /// Returns true if there is (or after login, will be) a valid session.
    /// Returns false if the user closed the login window without authenticating.
    /// </summary>
    private bool EnsureLoggedIn()
    {
        // Try to use existing stored session, refreshing if expired.
        // Task.Run avoids the classic WPF deadlock: .GetResult() blocks the UI thread,
        // but the async continuation needs the UI thread to resume → permanent hang.
        // Running on thread pool means the continuation doesn't need the UI thread.
        if (_sessionManager!.Current != null)
        {
            try
            {
                var token = Task.Run(() => _sessionManager.GetValidAccessTokenAsync()).GetAwaiter().GetResult();
                if (token != null)
                    return true;
            }
            catch
            {
                // Refresh failed — fall through to show login.
            }
        }

        var loginWindow = new LoginWindow(_auth!, _settings!);
        var result = loginWindow.ShowDialog();
        if (result != true || loginWindow.Result == null)
            return false;

        _sessionManager.SetSession(loginWindow.Result);
        return true;
    }

    private static int ResolveDeviceNumber(string deviceName)
    {
        if (string.IsNullOrEmpty(deviceName)) return 0;
        for (int i = 0; i < WaveInEvent.DeviceCount; i++)
        {
            if (WaveInEvent.GetCapabilities(i).ProductName == deviceName)
                return i;
        }
        return 0;
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _hotkey?.Dispose();
        _tray?.Dispose();
        _mutex?.ReleaseMutex();
        _mutex?.Dispose();
        base.OnExit(e);
    }
}
