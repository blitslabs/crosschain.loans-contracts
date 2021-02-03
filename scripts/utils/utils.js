const BigNumber = require('bignumber.js')

const pad = (num, size) => {
    let decimals = '1'
    while (decimals.length <= parseInt(size)) decimals = decimals + '0'
    return Number(BigNumber(num).multipliedBy(decimals).toString()).toLocaleString('fullwide', { useGrouping: false })
}

module.exports = {
    pad
}