namespace Tico.App.Services;

public record Session(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAtUtc,
    string UserId,
    string Email);

public record UsageInfo(
    string Tier,
    int Used,
    int Limit,
    int Remaining,
    bool Allowed);

public interface IAuthService
{
    Task<Session> LoginAsync(string email, string password, CancellationToken ct = default);
    Task<Session> RefreshAsync(string refreshToken, CancellationToken ct = default);
    Task LogoutAsync(string accessToken, CancellationToken ct = default);
}
