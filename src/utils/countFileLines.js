import countFileLines from "count-lines-in-file"

import Promise from "bluebird"

export default Promise.promisify(countFileLines)
