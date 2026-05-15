using System.IO;
using System.Windows.Media;

namespace Tico.App.Helpers;

public static class AudioHelper
{
    private static MediaPlayer? _player;
    private static string? _tempFile;

    public static async Task PlayMp3Async(byte[] mp3Data, CancellationToken ct = default)
    {
        StopPlayback();

        if (mp3Data.Length == 0) return;

        // Write to temp file (MediaPlayer needs a file URI)
        _tempFile = Path.Combine(Path.GetTempPath(), $"tico_audio_{Guid.NewGuid()}.mp3");
        await File.WriteAllBytesAsync(_tempFile, mp3Data, ct);

        var tcs = new TaskCompletionSource();

        // MediaPlayer must be created on UI thread
        System.Windows.Application.Current?.Dispatcher.Invoke(() =>
        {
            _player = new MediaPlayer();
            _player.Volume = 1.0; // Max volume
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

    public static void StopPlayback()
    {
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
