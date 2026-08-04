package com.enonic.lib.recaptcha;

import java.util.Map;

public final class HttpClientHandler
{
    private String url;

    private Map<String, String> params;

    public void setUrl( final String url )
    {
        this.url = url;
    }

    public void setParams( final Map<String, String> params )
    {
        this.params = params;
    }

    public String execute()
    {
        final String paramPart = params == null ? "<null>" : params.get( "secret" ) + "|" + params.get( "response" );
        return url + "|" + paramPart;
    }
}
