using System.IO;
using System.Windows.Media;

namespace Tico.App.Helpers;

public static class AudioHelper
{
    private static MediaPlayer? _player;
    private static string? _tempFile;
    private static bool _isPaused;

    public static bool IsPaused => _isPaused;

    public static async Task PlayMp3Async(byte[] mp3Data, CancellationToken ct = default)
    {
        StopPlayback();

        if (mp3Data.Length == 0) return;

        _tempFile = Path.Combine(Path.GetTempPath(), $"tico_audio_{Guid.NewGuid()}.mp3");
        await File.WriteAllBytesAsync(_tempFile, mp3Data, ct);

        var tcs = new TaskCompletionSource();

        System.Windows.Application.Current?.Dispatcher.Invoke(() =>
        {
            _player = new MediaPlayer();
            _player.Volume = 1.0;
            _player.MediaEnded += (_, _) => tcs.TrySetResult();
            _player.MediaFailed += (_, _) => tcs.TrySetResult();
            _player.Open(new Uri(_tempFile));
            _player.Play();
        });

        ct.Register(() =>
        {
            System.Windows.Application.Current?.Dispatcher.Invoke(StopPlayback);
            tcs.TrySetCanceled();
        });

        try { await tcs.Task; }
        catch (TaskCanceledException) { }
        finally { StopPlayback(); }
    }

    public static void PausePlayback()
    {
        System.Windows.Application.Current?.Dispatcher.Invoke(() =>
        {
            if (_player != null && !_isPaused)
            {
                _player.Pause();
                _isPaused = true;
            }
        });
    }

    public static void ResumePlayback()
    {
        System.Windows.Application.Current?.Dispatcher.Invoke(() =>
        {
            if (_player != null && _isPaused)
            {
                _player.Play();
                _isPaused = false;
            }
        });
    }

    public static void StopPlayback()
    {
        _isPaused = false;
        System.Windows.Application.Current?.Dispatcher.Invoke(() =>
        {
            _player?.Stop();
            _player?.Close();
            _player = null;
        });

        if (_tempFile != null)
        {
            try { File.Delete(_tempFile); } catch { }
            _tempFile = null;
        }
    }
}
