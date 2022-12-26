addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    try {
        await logRequestToSplunk(request)
    } catch (error) {
        console.error('failed transparent prefetch:', error)
    }
    const response = await fetch(request)
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
    })
}

async function logRequestToSplunk(request) {
    const splunkUrl = SPLUNK_HEC_URL
    const splunkToken = SPLUNK_HEC_TOKEN
    const method = request.method
    const url = request.url
    const targetFQDN = new URL(url).host
    const referrer = request.headers.get('referer')
    const userAgent = request.headers.get('user-agent')
    const cloudflareRayID = request.headers.get('cf-ray')
    const countryISO = request.headers.get('cf-ipcountry')
    const queryString = new URL(url).search
    const body = await request.text()
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    const additionalHeaders = {}
    for (let pair of request.headers.entries()) {
        if (pair[0] !== 'referer' && pair[0] !== 'user-agent' && pair[0] !== 'cf-ray' && pair[0] !== 'cf-connecting-ip' && pair[0] !== 'x-forwarded-for' && pair[0] !== 'x-real-ip' && pair[0] !== 'cf-ipcountry') {
            additionalHeaders[pair[0]] = pair[1]
        }
    }
    const event = {
        time: Date.now(),
        host: targetFQDN,
        source: 'logd-worker',
        event: {
            method: method,
            url: url,
            referrer: referrer,
            userAgent: userAgent,
            cloudflareRayID: cloudflareRayID,
            queryString: queryString,
            body: body,
            ip: ip,
            additionalHeaders: additionalHeaders,
            country: countryISO
        }
    };
    await fetch(splunkUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Splunk ${splunkToken}`,
            'Content-Type': 'application/json',
            'CF-Access-Client-Id': CF_CLIENTID,
            'CF-Access-Client-Secret': CF_SECRET
        },
        body: JSON.stringify(event)
    })
}