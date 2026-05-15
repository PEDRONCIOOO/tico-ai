using Tico.App.Services;

namespace Tico.Tests.Services;

public class TokenStoreTests : IDisposable
{
    private readonly string _testPath;

    public TokenStoreTests()
    {
        _testPath = Path.Combine(
            Path.GetTempPath(),
            $"tico_tokenstore_test_{Guid.NewGuid()}.dat");
    }

    public void Dispose()
    {
        if (File.Exists(_testPath))
        {
            try { File.Delete(_testPath); } catch { }
        }
    }

    [Fact]
    public void Load_returns_null_when_file_missing()
    {
        var store = new TokenStore(_testPath);
        Assert.Null(store.Load());
    }

    [Fact]
    public void Save_then_Load_roundtrips_session()
    {
        var store = new TokenStore(_testPath);
        var original = new Session(
            "access-token-value",
            "refresh-token-value",
            new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc),
            "user-id-123",
            "pedro@example.com");

        store.Save(original);
        var loaded = store.Load();

        Assert.NotNull(loaded);
        Assert.Equal(original.AccessToken, loaded!.AccessToken);
        Assert.Equal(original.RefreshToken, loaded.RefreshToken);
        Assert.Equal(original.ExpiresAtUtc, loaded.ExpiresAtUtc);
        Assert.Equal(original.UserId, loaded.UserId);
        Assert.Equal(original.Email, loaded.Email);
    }

    [Fact]
    public void Saved_file_is_not_plaintext()
    {
        var store = new TokenStore(_testPath);
        var session = new Session("super-secret-access", "refresh", DateTime.UtcNow, "id", "e@x.com");
        store.Save(session);

        var bytes = File.ReadAllBytes(_testPath);
        var asString = System.Text.Encoding.UTF8.GetString(bytes);
        Assert.DoesNotContain("super-secret-access", asString);
    }

    [Fact]
    public void Clear_removes_the_file()
    {
        var store = new TokenStore(_testPath);
        store.Save(new Session("a", "r", DateTime.UtcNow, "id", "e@x.com"));
        Assert.True(File.Exists(_testPath));

        store.Clear();
        Assert.False(File.Exists(_testPath));
        Assert.Null(store.Load());
    }

    [Fact]
    public void Load_returns_null_when_file_is_corrupted()
    {
        File.WriteAllBytes(_testPath, [0x01, 0x02, 0x03, 0x04, 0x05]);
        var store = new TokenStore(_testPath);
        Assert.Null(store.Load());
    }
}
