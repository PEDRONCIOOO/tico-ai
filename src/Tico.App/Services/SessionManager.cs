namespace Tico.App.Services;

public interface ISessionProvider
{
    Session? Current { get; }
    Task<string?> GetValidAccessTokenAsync(CancellationToken ct = default);
    Task ForceRefreshAsync(CancellationToken ct = default);
}

/// <summary>
/// Owns the user's Supabase session lifecycle: in-memory cache, DPAPI persistence,
/// proactive expiration check, and one-at-a-time refresh.
/// </summary>
public class SessionManager : ISessionProvider
{
    private readonly IAuthService _auth;
    private readonly TokenStore _store;
    private readonly SemaphoreSlim _refreshLock = new(1, 1);
    private Session? _session;

    public SessionManager(IAuthService auth, TokenStore store)
    {
        _auth = auth;
        _store = store;
        _session = store.Load();
    }

    public Session? Current => _session;

    public void SetSession(Session session)
    {
        _session = session;
        _store.Save(session);
    }

    public void Logout()
    {
        _session = null;
        _store.Clear();
    }

    public async Task<string?> GetValidAccessTokenAsync(CancellationToken ct = default)
    {
        if (_session == null)
            return null;

        if (!AuthService.IsExpired(_session.ExpiresAtUtc, DateTime.UtcNow))
            return _session.AccessToken;

        await ForceRefreshAsync(ct);
        return _session?.AccessToken;
    }

    public async Task ForceRefreshAsync(CancellationToken ct = default)
    {
        await _refreshLock.WaitAsync(ct);
        try
        {
            if (_session == null)
                return;

            // Re-check after acquiring the lock — another thread may have refreshed already.
            if (!AuthService.IsExpired(_session.ExpiresAtUtc, DateTime.UtcNow))
                return;

            try
            {
                var fresh = await _auth.RefreshAsync(_session.RefreshToken, ct);
                _session = fresh;
                _store.Save(fresh);
            }
            catch
            {
                // Refresh token is dead — user needs to log in again.
                _session = null;
                _store.Clear();
            }
        }
        finally
        {
            _refreshLock.Release();
        }
    }
}
