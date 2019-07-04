import firstline from "firstline"

import {
    BloomFilter,
} from "bloomfilter"

import lzjs from "lzjs"

import Promise from "bluebird"

export default (hashes, hashesparams) => new Promise((resolve) =>
    Promise.all([firstline(hashesparams), firstline(hashes)]).then((val) =>
        resolve(new BloomFilter(JSON.parse(lzjs.decompress(val[1])), parseInt(val[0])))
    )
)
