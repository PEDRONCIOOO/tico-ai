using Tico.App.Services;

namespace Tico.Tests.Services;

public class AudioCaptureServiceTests
{
    [Fact]
    public void ComputeRmsPower_returns_zero_for_silence()
    {
        var silence = new byte[200]; // all zeros
        var power = AudioCaptureService.ComputeRmsPower(silence, silence.Length);
        Assert.Equal(0, power);
    }

    [Fact]
    public void ComputeRmsPower_returns_zero_for_empty_buffer()
    {
        var power = AudioCaptureService.ComputeRmsPower([], 0);
        Assert.Equal(0, power);
    }

    [Fact]
    public void ComputeRmsPower_normalizes_max_amplitude_to_near_one()
    {
        // Max-amplitude square wave (alternating +32767 / -32767)
        var buffer = new byte[400];
        for (int i = 0; i < buffer.Length; i += 2)
        {
            short sample = (i / 2) % 2 == 0 ? (short)32767 : (short)-32767;
            buffer[i] = (byte)(sample & 0xFF);
            buffer[i + 1] = (byte)((sample >> 8) & 0xFF);
        }

        var power = AudioCaptureService.ComputeRmsPower(buffer, buffer.Length);

        // RMS of max-amplitude = 32767/32768 ≈ 0.99997
        Assert.InRange(power, 0.99, 1.01);
    }

    [Fact]
    public void ComputeRmsPower_quiet_signal_is_lower_than_loud_signal()
    {
        var quiet = MakeBufferAtAmplitude(1000, 200);
        var loud = MakeBufferAtAmplitude(20000, 200);

        var quietPower = AudioCaptureService.ComputeRmsPower(quiet, quiet.Length);
        var loudPower = AudioCaptureService.ComputeRmsPower(loud, loud.Length);

        Assert.True(quietPower < loudPower);
        Assert.True(quietPower > 0);
    }

    private static byte[] MakeBufferAtAmplitude(short amplitude, int byteCount)
    {
        var buffer = new byte[byteCount];
        for (int i = 0; i + 1 < byteCount; i += 2)
        {
            buffer[i] = (byte)(amplitude & 0xFF);
            buffer[i + 1] = (byte)((amplitude >> 8) & 0xFF);
        }
        return buffer;
    }
}
