//#region global variables
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const CELL_SIZE = 16;
const ROWS = GAME_HEIGHT / CELL_SIZE;
const COLS = GAME_WIDTH / CELL_SIZE;

let cellManager = undefined;
let cellManagerController = undefined;
//#endregion

//#region lib keypress setup
const keyListener = new window.keypress.Listener();
//#endregion

//#region lib PixiJS setup
const pixiApp = new PIXI.Application({
  width: 1280,
  height: 720,
  backgroundColor: 0x111111,
  resolution: window.devicePixelRatio || 1
});
document.getElementById("game").appendChild(pixiApp.view);
//#endregion

//#region init
function init() {
  // make the cellManager and cellManagerController
  cellManager = new CellManager(ROWS, COLS, CELL_SIZE, true, true);
  cellManagerController = new CellManagerController(cellManager);

  // setup keybinds
  keyListener.simple_combo("space", function() {
    cellManagerController.togglePause();
  });
  keyListener.simple_combo("r", function() {
    cellManagerController.randomize();
  });
  keyListener.simple_combo("c", function() {
    cellManagerController.clear();
  });
  keyListener.simple_combo("n", function() {
    cellManagerController.nextGeneration();
  });

  // start the gameloop
  pixiApp.ticker.add(() => {
    let deltaTime = pixiApp.ticker.elapsedMS;
    update(deltaTime);
    draw();
  });
}
//#endregion

//#region gameloop
function update(deltaTime) {
  cellManager.update(deltaTime);
}

function draw() {
  cellManager.draw();
}
//#endregion

//#region utils
function lerp(a, b, amount) {
  return a + amount * (b - a);
}
//#endregion

class CellManagerController
{
  cellManager = undefined;

  constructor(cellManager)
  {
    this.cellManager = cellManager;
  }

  togglePause()
  {
    this.cellManager.togglePause();
  }

  randomize()
  {
    this.cellManager.randomize();
  }

  clear()
  {
    this.cellManager.clear();
  }

  nextGeneration()
  {
    if (this.cellManager.paused)
    {
      this.cellManager.updateGeneration();
    }
  }
}

class CellManager
{
  cellGraphics = undefined;
  CELL_COLOR   = 0xEEEEEE;
  DECAY_COLOR  = 0x15B2D1;

  cells      = undefined;
  nextCells  = undefined;
  neighbours = undefined;
  cellAlpha  = undefined;
  wrap       = undefined;
  rows       = undefined;
  cols       = undefined;
  cellSize   = undefined;

  timer = 0;
  cellUpdateFPS = 15;
  lerpAmount = 0.075;
  paused = false;

  constructor(rows, cols, cellSize, random, wrap)
  {
    this.rows = rows;
    this.cols = cols;
    this.cellSize = cellSize;
    this.wrap = wrap;

    this.cellGraphics = new PIXI.Graphics();
    pixiApp.stage.addChild(this.cellGraphics);
    this.initCells(random);
  }

  initCells(random) {
    this.cells = [];
    this.nextCells = [];
    this.neighbours = [];
    this.cellAlpha = [];
    for (let row = 0; row < this.rows; row++)
    {
      let cellRow = [];
      let nextCellRow = [];
      let neighbourRow = [];
      let alphaRow = [];
      for (let col = 0; col < this.cols; col++)
      {
        cellRow.push(false);
        nextCellRow.push(0);
        neighbourRow.push(0);
        alphaRow.push(0);
      }
      this.cells.push(cellRow);
      this.nextCells.push(nextCellRow);
      this.neighbours.push(neighbourRow);
      this.cellAlpha.push(alphaRow);
    }

    if (random)
    {
      this.randomize();
    }
  }

  //#region gameloop
  update(dt)
  {
    if (!this.paused)
    {
      this.timer += dt;
      if (this.timer >= 1/this.cellUpdateFPS*1000)
      {
        this.timer -= 1/this.cellUpdateFPS*1000;
        this.updateGeneration();
      }
    }
    this.updateAlpha();
  }

  updateGeneration()
  {
    this.calculateNextGeneration();
    this.applyNextGeneration();
  }

  draw()
  {
    this.cellGraphics.clear();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        let color = this.getAlive(row, col) ? this.CELL_COLOR : this.DECAY_COLOR;
        this.cellGraphics.beginFill(color, this.getAlpha(row, col));
        // this.cellGraphics.drawRect(col * this.cellSize, row * this.cellSize, this.cellSize, this.cellSize);
        this.cellGraphics.drawRect(col * this.cellSize + 1, row * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2);
      }
    }
  }
  //#endregion

  //#region reset
  randomize()
  {
    for (let row = 0; row < this.rows; row++)
    {
      for (let col = 0; col < this.cols; col++)
      {
        let rand = Math.floor(Math.random() * 1.75);
        let alive = rand ? true : false;
        this.setAlive(row, col, alive);
        this.setAlpha(row, col, rand);
      }
    }

    for (let row = 0; row < this.rows; row++)
    {
      for (let col = 0; col < this.cols; col++)
      {
        let neighbours = this.getAliveNeighbours(row, col);
        this.setNeighbours(row, col, neighbours);
      }
    }
  }

  clear()
  {
    for (let row = 0; row < this.rows; row++)
    {
      for (let col = 0; col < this.cols; col++)
      {
        this.setAlive(row, col, false);
        this.setAlpha(row, col, 0);
        this.setNeighbours(row, col, 0);
      }
    }
  }
  //#endregion

  togglePause()
  {
    this.paused = !this.paused;
  }

  updateAlpha()
  {
    for (let row = 0; row < this.rows; row++)
    {
      for (let col = 0; col < this.cols; col++)
      {
        if (!this.getAlive(row, col))
        {
          let alpha = this.getAlpha(row, col);
          if (alpha > 0)
          {
            alpha = lerp(alpha, 0, this.lerpAmount);
            if (alpha < 0.005)
            {
              alpha = 0;
            }
          }
          this.setAlpha(row, col, alpha);
        }
        else
        {
          this.setAlpha(row, col, 1);
        }
      }
    }
  }

  calculateNextGeneration() {
    for (let row = 0; row < this.rows; row++)
    {
      for (let col = 0; col < this.cols; col++)
      {
        this.setNeighbours(row, col, this.getAliveNeighbours(row, col));
      }
    }
    for (let row = 0; row < this.rows; row++)
    {
      for (let col = 0; col < this.cols; col++)
      {
        let neighbours = this.getNeighbours(row, col);
        if (this.getAlive(row, col))
        {
          if (neighbours === 2 || neighbours === 3)
          {
            this.setNext(row, col, true);
          }
          else
          {
            this.setNext(row, col, false);
          }
        }
        else
        {
          if (neighbours === 3)
          {
            this.setNext(row, col, true);
          }
          else
          {
            this.setNext(row, col, false);
          }
        }
      }
    }
  }

  applyNextGeneration()
  {
    for (let row = 0; row < this.rows; row++)
    {
      for (let col = 0; col < this.cols; col++)
      {
        this.setAlive(row, col, this.getNext(row, col));
      }
    }
  }

  getAliveNeighbours(row, col) {
    let aliveNeighbours = 0;
    for (let i = row - 1; i <= row + 1; i++)
    {
      for (let j = col - 1; j <= col + 1; j++)
      {
        if (i === row && j === col)
        {
          continue;
        }
        if (this.inBounds(i, j) && this.getAlive(i, j))
        {
          aliveNeighbours++;
        }
      }
    }
    return aliveNeighbours;
  }

  inBounds(row, col)
  {
    return (row >= 0 && row < this.rows) && (col >= 0 && col < this.cols);
  }

  //#region getter / setters
  getAlive(row, col)
  {
    return this.cells[row][col];
  }

  setAlive(row, col, alive)
  {
    this.cells[row][col] = alive;
  }

  setNext(row, col, alive)
  {
    this.nextCells[row][col] = alive;
  }

  getNext(row, col)
  {
    return this.nextCells[row][col];
  }

  getNeighbours(row, col)
  {
    return this.neighbours[row][col];
  }

  setNeighbours(row, col, value)
  {
    this.neighbours[row][col] = value;
  }

  getAlpha(row, col)
  {
    return this.cellAlpha[row][col];
  }

  setAlpha(row, col, value)
  {
    this.cellAlpha[row][col] = value;
  }
  //#endregion
}

init();
