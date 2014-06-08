Array.prototype.median = function() {
    this.sort(function(a,b){return a-b});

    return this[Math.floor(this.length / 2)];
};