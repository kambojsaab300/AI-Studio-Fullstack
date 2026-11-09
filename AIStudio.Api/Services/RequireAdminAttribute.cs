using System;
using System.Threading.Tasks;
using AIStudio.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AIStudio.Api.Services
{
    /// <summary>
    /// Put on a controller or action to require a server-signed admin JWT.
    /// Requests without a valid admin token get 401 before the action runs.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
    public class RequireAdminAttribute : Attribute, IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            if (!await IsAdminRequestAsync(context.HttpContext))
            {
                context.Result = new UnauthorizedObjectResult(new { success = false, error = "Admin login required" });
                return;
            }
            await next();
        }

        /// <summary>
        /// True when the request carries a signature-verified token that is admin, either by its claim
        /// or by the database (ai_studio_admins / admin role). The DB check covers tokens issued before
        /// the user was made admin, which the admin UI already treats as admin via is_ai_studio_admin.
        /// A forged or unsigned token is never admin.
        /// </summary>
        public static async Task<bool> IsAdminRequestAsync(HttpContext http)
        {
            var config = http.RequestServices.GetRequiredService<IConfiguration>();
            if (!AdminTokenValidator.TryGetVerifiedUser(http.Request, config, out var userId, out bool isAdmin)) return false;
            if (isAdmin) return true;
            if (string.IsNullOrEmpty(userId)) return false;
            var db = http.RequestServices.GetRequiredService<DatabaseService>();
            return await db.IsAdminAsync(userId);
        }
    }
}
