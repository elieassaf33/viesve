from django.conf import settings


class DefaultLithuanianLocaleMiddleware:
    """
    Ensure Lithuanian ('lt') is always the main/default language on unprefixed URLs,
    preventing browser Accept-Language headers (e.g. en-US) from overriding 'lt'.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        lang_cookie = request.COOKIES.get(settings.LANGUAGE_COOKIE_NAME)
        if not request.path_info.startswith("/en/") and not lang_cookie:
            request.META["HTTP_ACCEPT_LANGUAGE"] = "lt"
        return self.get_response(request)
