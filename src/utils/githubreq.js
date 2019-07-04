import request from "./request"

export default request.defaults({
    json: true,
    headers: {
        "Accept": "application/vnd.github.v3+json",
    },
})
