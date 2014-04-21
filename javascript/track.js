var Piece = require('./piece.js');

function buildTrackPieces(pieces)
{
	builtPieces = new Array();
	
	for(var i = 0; i < pieces.length; i++) {
		var pieceData = pieces[i];
		var piece = new Piece(pieceData, i);
		
		builtPieces.push(piece);
	}
	
	return builtPieces;
}

function Track(data) {
	this.id = data.id;
	this.name = data.name;
	this.lanes = data.lanes;
	
	this.pieces = buildTrackPieces(data.pieces);
    this.biggestStraightIndex = biggestStraight(this.pieces);
}

function biggestStraight(pieces){
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
                if(lastStraightIndex < pieces.length - 1 )
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
    console.log(" Biggest straight: " + biggestStraightCount + " @ " + biggestStraightIndex )
    return biggestStraightIndex;
}

module.exports = Track;