var Piece = require('./piece.js');

function Track(data, raceInfo) {
    this.id = data.id;
    this.name = data.name;
    this.lanes = data.lanes;
    this.pieces = [];

    // If this is a qualifying laps are not defined. As we use them, just a workaround to simulate
    // as if there were as many laps as seconds
    this.laps = raceInfo.laps === undefined ? raceInfo.durationMs / 1000 : raceInfo.laps;
    this.durationMs = raceInfo.durationMs;

    declarePrivateMethods.call(this);

    this.buildTrackPieces(data.pieces);

    var indexes = biggestAndLastStraightIndexes(this.pieces);
    this.biggestStraightIndex = indexes.biggestStraightIndex;
    this.lastStraightIndex = indexes.lastStraightIndex;
}

Track.prototype.distanceFromPieceToPiece = function(pieceFrom, pieceTo, laneFrom, laneTo) {
    var toPieceDistance = 0;
    var pieceToVerify = pieceFrom;

    while(pieceToVerify.index != pieceTo.index) {
        if(pieceToVerify.index != pieceTo.index)
            toPieceDistance += pieceToVerify.lengthInLane(laneFrom, laneTo);

        pieceToVerify = pieceToVerify.nextPiece;
    }

    return toPieceDistance;
};

// This is 2 in 1 function, because one value depends on each other.
// I know this is lazy, I'm sorry
function biggestAndLastStraightIndexes(pieces){
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
    console.log(" Biggest straight: " + biggestStraightCount + " @ " + biggestStraightIndex );
    // Store the last straight index so at the last lap, driver will never stop throttling
    return {biggestStraightIndex: biggestStraightIndex, lastStraightIndex: lastStraightIndex};
}

function declarePrivateMethods() {
    this.buildTrackPieces = function(piecesInfo) {
        this.buildTrackPiece(piecesInfo, 0);
        this.pieces.reverse();
        this.pieces[this.pieces.length - 1].nextPiece = this.pieces[0];

        this.calculateBendIndexes();
    };

    this.buildTrackPiece = function(piecesInfo, index) {
        var piece = new Piece(piecesInfo[index], index);
        var nextIndex = index + 1;

        if(nextIndex < piecesInfo.length)
            piece.nextPiece = this.buildTrackPiece(piecesInfo, nextIndex);

        this.pieces.push(piece);

        return piece;
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
}

module.exports = Track;