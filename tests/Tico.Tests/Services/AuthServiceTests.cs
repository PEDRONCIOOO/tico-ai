using Tico.App.Services;

namespace Tico.Tests.Services;

public class AuthServiceTests
{
    [Fact]
    public void ParseSession_extracts_all_fields_from_supabase_response()
    {
        var json = """
        {
          "access_token": "ey.access",
          "refresh_token": "ey.refresh",
          "expires_at": 1775711805,
          "token_type": "bearer",
          "expires_in": 3600,
          "user": {
            "id": "abc-123",
            "email": "pedro@example.com"
          }
        }
        """;

        var session = AuthService.ParseSession(json);

        Assert.Equal("ey.access", session.AccessToken);
        Assert.Equal("ey.refresh", session.RefreshToken);
        Assert.Equal("abc-123", session.UserId);
        Assert.Equal("pedro@example.com", session.Email);
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(1775711805).UtcDateTime, session.ExpiresAtUtc);
    }

    [Fact]
    public void ParseSession_throws_when_access_token_missing()
    {
        var json = """{"refresh_token":"x","expires_at":1,"user":{"id":"a","email":"b"}}""";
        Assert.Throws<KeyNotFoundException>(() => AuthService.ParseSession(json));
    }

    [Fact]
    public void ParseUsage_extracts_check_usage_rpc_response()
    {
        var json = """
        {"tier":"free","used":3,"limit":10,"remaining":7,"allowed":true}
        """;

        var usage = AuthService.ParseUsage(json);

        Assert.Equal("free", usage.Tier);
        Assert.Equal(3, usage.Used);
        Assert.Equal(10, usage.Limit);
        Assert.Equal(7, usage.Remaining);
        Assert.True(usage.Allowed);
    }

    [Fact]
    public void ParseUsage_handles_unlimited_tier()
    {
        var json = """
        {"tier":"unlimited","used":999,"limit":-1,"remaining":-1,"allowed":true}
        """;

        var usage = AuthService.ParseUsage(json);

        Assert.Equal("unlimited", usage.Tier);
        Assert.Equal(-1, usage.Limit);
        Assert.True(usage.Allowed);
    }

    [Fact]
    public void IsExpired_returns_true_when_already_past()
    {
        var now = new DateTime(2026, 4, 9, 12, 0, 0, DateTimeKind.Utc);
        var expires = now.AddMinutes(-1);
        Assert.True(AuthService.IsExpired(expires, now));
    }

    [Fact]
    public void IsExpired_returns_true_within_skew_window()
    {
        var now = new DateTime(2026, 4, 9, 12, 0, 0, DateTimeKind.Utc);
        var expires = now.AddSeconds(15); // Within default 30s skew
        Assert.True(AuthService.IsExpired(expires, now));
    }

    [Fact]
    public void IsExpired_returns_false_when_well_in_future()
    {
        var now = new DateTime(2026, 4, 9, 12, 0, 0, DateTimeKind.Utc);
        var expires = now.AddMinutes(10);
        Assert.False(AuthService.IsExpired(expires, now));
    }

    [Fact]
    public void ParseError_translates_invalid_credentials()
    {
        var json = """{"error":"invalid_grant","error_description":"Invalid login credentials"}""";
        var msg = AuthService.ParseError(json);
        Assert.Equal("email ou senha incorretos", msg);
    }

    [Fact]
    public void ParseError_returns_msg_field_when_present()
    {
        var json = """{"code":400,"msg":"Custom error"}""";
        var msg = AuthService.ParseError(json);
        Assert.Equal("Custom error", msg);
    }

    [Fact]
    public void ParseError_returns_null_for_invalid_json()
    {
        var msg = AuthService.ParseError("not json");
        Assert.Null(msg);
    }
}
