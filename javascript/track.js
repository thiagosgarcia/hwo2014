var Logger = require("./logger.js");
var Piece = require('./piece.js');
var Lane = require('./lane.js');

function Track(data, raceInfo) {
    this.id = data.id;
    this.name = data.name;

    this.lanes = [];
    this.pieces = [];

    // If this is a qualifying laps are not defined. As we use them, just a workaround to simulate
    // as if there were as many laps as seconds
    this.laps = raceInfo.laps === undefined ? raceInfo.durationMs / 1000 : raceInfo.laps;
    this.durationMs = raceInfo.durationMs;

    declarePrivateMethods.call(this);

    this.buildTrackPieces(data.pieces);
    this.buildTrackLanes(data.lanes);

    var indexes = biggestAndLastStraightIndexes(this.pieces);
    this.biggestStraightIndex = indexes.biggestStraightIndex;
    this.lastStraightIndex = indexes.lastStraightIndex;
}

// This is 2 in 1 function, because one value depends on each other.
// I know this is lazy, I'm sorry
function biggestAndLastStraightIndexes(pieces) {
    var straightCount = 0;

    var biggestStraightIndex = 0;
    var biggestStraightCount = 0;
    var lastStraightIndex = -1;
    var i = pieces.length;

    while(i-- > 0){
        // On straight, it increments the counter
        if(pieces[i].type === "S"){
            straightCount += pieces[i].length;
        }else{
            // If not straight, lets calculate the biggest one
            if(straightCount > biggestStraightCount){
                biggestStraightCount = straightCount;
                biggestStraightIndex = i + 1;
            }
            // Store the beginning of the last straight for further calculations
            if(lastStraightIndex == -1){
                // If the track starts on a bend, I cannot store this now
                if(i < pieces.length - 1 )
                    lastStraightIndex = i + 1;
            }
            // Reset values
            straightCount = 0;
        }
    }
    // If it starts on a bend, there's no need to see the line-up straight size
    if(lastStraightIndex != -1){
        straightCount = 0;
        var i = lastStraightIndex - 1;
        // See the size of the line-up straight
        while(pieces[++i].type === "S"){
            straightCount += pieces[i].length;
            // Go back to first if the lap is finished
            if(i >= pieces.length - 1)
                i = -1;
        }
        // If line-up straight is the biggest one
        if(straightCount > biggestStraightCount){
            biggestStraightCount = straightCount;
            biggestStraightIndex = lastStraightIndex;
        }
    }
    Logger.log(" Biggest straight: " + biggestStraightCount + " @ " + biggestStraightIndex );
    // Store the last straight index so at the last lap, driver will never stop throttling
    return {biggestStraightIndex: biggestStraightIndex, lastStraightIndex: lastStraightIndex};
}

function declarePrivateMethods() {
    this.buildTrackPieces = function(piecesInfo) {
        this.buildTrackPiece(piecesInfo, 0);
        this.pieces.reverse();

        this.pieces[this.pieces.length - 1].nextPiece = this.pieces[0];
        this.pieces[0].previousPiece = this.pieces[this.pieces.length - 1];

        this.calculateBendIndexes();
        this.setChicanes(this.pieces);
    };

    this.buildTrackPiece = function(piecesInfo, index) {
        var piece = new Piece(piecesInfo[index], index, this);
        var nextIndex = index + 1;

        if(nextIndex < piecesInfo.length)
            piece.nextPiece = this.buildTrackPiece(piecesInfo, nextIndex);

        var nextPiece = piece.nextPiece;
        if(nextPiece != null)
            piece.nextPiece.previousPiece = piece;

        this.pieces.push(piece);
        return piece;
    };

    this.buildTrackLanes = function(lanes) {
        for(var i = 0; i < lanes.length; i++) {
            var laneInfo = lanes[i];
            var lane = new Lane(laneInfo);

            this.lanes.push(lane);
        }
    };

    this.calculateBendIndexes = function() {
        var pieces = this.pieces;
        var currentBendIndex = 0;

        for(var i = 0; i < pieces.length; i++) {
            var currentPiece = pieces[i];
            var nextPiece = currentPiece.nextPiece;

            if(currentPiece.type == "S")
                continue;

            currentPiece.bendIndex = currentBendIndex;
            if((nextPiece.type == "S") ||
                (currentPiece.angle !== nextPiece.angle) ||
                (currentPiece.radius !== nextPiece.radius)) {

                currentBendIndex++;
            }
        }

        if(pieces[0].type == "B")
            this.correctLastBendIndex();
    };

    this.correctLastBendIndex = function() {
        var firstPiece = pieces[0];
        var lastPiece = pieces[pieces.length - 1];
        var lastBendIndex = lastPiece.bendIndex;

        if((firstPiece.angle === lastPiece.angle) &&
            (firstPiece.radius === lastPiece.radius)) {

            for(var i = pieces.length - 1; i >= 0 ; i--) {
                var piece = pieces[i];

                if(piece.bendIndex == lastBendIndex) {
                    piece.bendIndex = firstPiece.bendIndex;
                    continue;
                }

                break;
            }
        }
    };

    this.setChicanes = function(pieces){
        var i = -1;
        var angleCounter = 0;
        var firstIndex = null;
        var lastIndex = null;
        var smallStraights = 0;
        var pieceToVerify = null;
        while (++i < pieces.length - 1){
            var lastPiece = pieceToVerify;
            pieceToVerify = pieces[i];
            var nextPiece = pieces[i+1];

            if(pieceToVerify.length > 100)
                continue;

            if(pieceToVerify.type == "B"){
                angleCounter += pieceToVerify.angle;
                firstIndex = firstIndex == null ? i : firstIndex;
                lastIndex = i;
                smallStraights = 0;
            }

            if(!!lastPiece && lastPiece.type == "B" && nextPiece.type == "B"
                && lastPiece.angle + nextPiece.angle == 0 && pieceToVerify.length <= 30){
                continue;
            }

            if(firstIndex != null && lastIndex != null && angleCounter == 0 && smallStraights == 0){
                this.setPiecesAsChicanes(pieces, firstIndex, lastIndex);
            }
            if(pieceToVerify.type == "S") {
                firstIndex = null;
                lastIndex = null;
                angleCounter = 0;
                continue;
            }

            if(pieceToVerify.radius != nextPiece.radius && pieceToVerify.type == "B" && nextPiece.type == "B"  ){
                angleCounter = 0;
                firstIndex = null;
                lastIndex = null;
                continue;
            }
        }
    };

    this.setPiecesAsChicanes = function(pieces, initialIndex, finalIndex){
        for(var i = initialIndex; i < finalIndex - 1; i++){
            pieces[i].isInChicane = true;
        }
    };
}

module.exports = Track;