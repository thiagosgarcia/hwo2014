var Piece = require('./piece.js');

function buildTrackPieces(pieces)
{
	builtPieces = new Array();
	
	for(var i = 0; i < pieces.length; i++) {
		var pieceData = pieces[i];
		var piece = new Piece(pieceData);
		
		builtPieces.push(piece);
	}
	
	return builtPieces;
}

function Track(data) {
	this.id = data.id;
	this.name = data.name;
	this.lanes = data.lanes;
	
	this.pieces = buildTrackPieces(data.pieces);
}

module.exports = Track;