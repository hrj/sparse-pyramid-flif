import sys.process.Process

val dir = args(0)

val NumTiles = 32
val TileSize = 512

val levels = Integer.numberOfTrailingZeros(NumTiles)
println("levels = " + levels)

var availableLevels = List(levels)

def fileExists(f: String) = java.nio.file.Files.exists(java.nio.file.Paths.get(f))

val halfScaleRegex = """1:2 scale: (\d+) bytes""".r

def getHalfBytes(fileName: String) = {
  // val halfBytes = Process("flif -b " + fileName).lineStream.toList.flatMap(l => halfScaleRegex.unapplySeq(l).map(_.head.toInt)).head
  halfScaleRegex.unapplySeq(Process("flif -b " + fileName).lineStream.last).map(_.head.toInt).get
}

def tilesInLevel(l:Int) = NumTiles >> (levels - l)

def buildLevel(l: Int) = {
  val prevLevel = availableLevels.last
  val prevBase = if (prevLevel == levels) "eso-png/tile" else s"pyramid-${prevLevel}"
  println("Building Level: " + l + " from " + prevLevel)
  val numTilesInThisLevel = tilesInLevel(l)
  val numTilesInPrevLevel = tilesInLevel(prevLevel)
  println("Tiles in  Level: " + numTilesInThisLevel)
  println("Tiles in  prev Level: " + numTilesInPrevLevel)
  val tilesToMerge = numTilesInPrevLevel / numTilesInThisLevel
  println("Tiles to merge : " + tilesToMerge)
  for (row <- 0 until numTilesInThisLevel) {
    for (col <- 0 until numTilesInThisLevel) {
      println(s"  building tile: $row x $col")
      val inTiles = (1 to tilesToMerge).flatMap(i =>
        (1 to tilesToMerge).map(j => s"${prevBase}-${row*tilesToMerge + i}-${col*tilesToMerge + j}.png")
      )
      val pyr = s"pyramid-${l}-${row+1}-${col+1}"
      if (!fileExists(s"${pyr}.png")) {
        val mntCmd = "montage -mode concatenate " + inTiles.mkString(" ") + " combined.png"
        println(mntCmd)
        Process(mntCmd).run.exitValue
        Process(s"convert -resize 512 -filter Box combined.png ${pyr}.png").run.exitValue
      }
      if (!fileExists(s"${pyr}.flif")) {
        Process(s"flif ${pyr}.png ${pyr}.flif").run.exitValue
      }
    }
  }
  availableLevels :+= l
}

for (l <- (levels-2) to 2 by -2) {
  buildLevel(l)
}

buildLevel(1)
buildLevel(0)


def makeTileInfo(N: Int, base: String):String = {
  val bytes = (1 to N) map { row =>
    (1 to N) map { col =>
      val fileName = s"${base}$row-$col.flif"
      val halfBytes = getHalfBytes(fileName)
      // println(s"half bytes $row x $col: $halfBytes")
      halfBytes.toString
    }
  }
  bytes.map(_.mkString("[", ",", "]")).mkString("[", ",", "]")
}

val info:Seq[String] = ((0 to levels) map {l =>
  if (availableLevels.contains(l)) {
    makeTileInfo(tilesInLevel(l), if (l == levels) {dir + "/tile-"} else {s"pyramid-$l-"})
  } else {
    "null"
  }
})

val writer = java.nio.file.Files.newBufferedWriter(java.nio.file.Paths.get("tile-info2.json"))
writer.write(info.mkString("[", ",", "]"))
writer.close
