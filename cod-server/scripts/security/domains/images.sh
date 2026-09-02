# Media upload (invalid bodies → validation 400 after the wall; never reaches R2)
ep POST "/api/images/upload"                              products:manage        '{}'
ep POST "/api/images/presign"                            products:manage        '{"contentType":"text/html"}'
