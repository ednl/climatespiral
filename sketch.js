// Data property parameters
const anomalymin = -1.0; // anomaly value at the origin (must be < 0)
const anomalymax =  1.5; // anomaly value at the edge (must be > 0)
let months, data;

// Visualisation parameters
const canvassize = 800;  // canvas width and height in pixels
const bgcolour   = 0;    // black background
const gridcolour = 102;  // grey grid
const axescolour = 153;  // light grey axes
const ticksize   = 0.03; // size of ticks on axes in scaled coordinates
let cool, neutral, warm; // blue, white, red; defined in setup()

// Derived constants for internal use
const range = anomalymax - anomalymin;               // axes go from -range to +range in scaled coordinates
const origin = canvassize / 2;                       // origin centered on the canvas
const scalefactor = canvassize / (range * 2 * 1.12); // *2 for [-range..+range], 12% margin
const pixelsize   = 1 / scalefactor;                 // size of 1 pixel in scaled coordinates
const borderdist  = 0.5 * canvassize * pixelsize;    // distance from origin to canvas border in scaled coordinates
const textheight1 = borderdist / 20;
const textheight2 = borderdist / 8;
const rangelog = Math.exp(range) - 1;
const rangesqr = range * range;
const monthradius = -range * 1.06 + 2 * pixelsize; // correction for textAlign(..,CENTER) not working!

// Variables
let func = rlin; // graph type = linear (rlin), logarithmic (rlog), quadratic (rsqr)
let chkGrid, chkAxes, chkTicks, radioGraphtype;
let index = 0, maxindex;
let angles;

// Linear translation from degree celsius to circle radius
function rlin(celsius) {
  if (celsius <= anomalymin)
    return 0;
  return celsius - anomalymin;
}

// Logarithmic translation from degree celsius to circle radius
function rlog(celsius) {
  if (celsius <= anomalymin)
    return 0;
  const pct = (celsius - anomalymin) / range; // [0..1]
  return Math.log(1 + pct * rangelog);        // [0..range]
}

// Quadratic translation from degree celsius to circle radius
function rsqr(celsius) {
  if (celsius <= anomalymin)
    return 0;
  const pct = (celsius - anomalymin) / range; // [0..1]
  return Math.sqrt(pct * rangesqr);           // [0..range]
}

function showgrid(gridstep) {
  stroke(gridcolour);
  strokeWeight(0.5 * pixelsize);
  // Gridlines on the axes
  line(0, -borderdist, 0, borderdist);
  line(-borderdist, 0, borderdist, 0);
  // Other gridlines
  if (gridstep > 0) {
    const count = Math.round(range / gridstep);
    for (let i = 1; i <= count; ++i) {
      const c = anomalymin + i * gridstep;
      const r = func(c);
      line(r, -borderdist, r, borderdist);
      line(-r, -borderdist, -r, borderdist);
      line(-borderdist, r, borderdist, r);
      line(-borderdist, -r, borderdist, -r);
    }
  }
}

function showaxes(tickstep) {
  stroke(axescolour);
  strokeWeight(1 * pixelsize);
  // Axes
  line(0, -borderdist, 0, borderdist);
  line(-borderdist, 0, borderdist, 0);
  // Ticks
  if (tickstep > 0) {
    const count = Math.round(range / tickstep);
    for (let i = 1; i <= count + 1; ++i) {
      const c = anomalymin + i * tickstep;
      const r = func(c);
      line(r, ticksize, r, -ticksize);
      line(-r, ticksize, -r, -ticksize);
      line(ticksize, r, -ticksize, r);
      line(ticksize, -r, -ticksize, -r);
    }
  }
}

function refcircle(celsius) {
  const c = gradient(celsius);
  const radius = func(celsius);
  stroke(c);
  strokeWeight(4 * pixelsize);
  noFill();
  circle(0, 0, radius * 2);

  textSize(textheight1);
  const labeltext = nf(celsius, 1, 1) + '°C';
  const labelsize = textWidth(labeltext);
  const labelpos = -radius; // y coordinate still inverted, otherwise text would be upside down
  noStroke();
  fill(bgcolour); // erase background for label
  rect(0, labelpos, labelsize + 8 * pixelsize, textheight1 + 2 * pixelsize);
  fill(c);
  text(labeltext, 0, labelpos + 7 * pixelsize); // correction for textAlign(..,CENTER) not working!
}

function gradient(celsius) {
  if (celsius >= 0)
    return lerpColor(neutral, warm, celsius / anomalymax);
  return lerpColor(neutral, cool, celsius / anomalymin);
}

function axeschanged() {
  if (!chkAxes.checked() && chkTicks.checked())
    chkTicks.checked(false);
}

function tickschanged() {
  if (chkTicks.checked() && !chkAxes.checked())
    chkAxes.checked(true);
}

function preload() {
  // Downloaded from https://data.giss.nasa.gov/gistemp/
  // "Global-mean monthly, seasonal, and annual means, 1880-present"
  data = loadTable("global-temp-anomaly-1880-2023-mar.csv", "csv", "header");
}

function setup() {
  months = data.columns.slice(1, 13);
  maxindex = months.length * data.getRowCount() - 1;
  // console.log(maxindex);
  for (let i = months.length - 1; i >= 0; --i)
    if (data.getString(data.getRowCount() - 1, months[i]) === '***')
      --maxindex;
    else
      break;
  // console.log(maxindex);
  angles = new Array(months.length);
  let a = -Math.PI / 2; // start at centre-top
  for (let i = 0; i < months.length; ++i) {
    angles[i] = {x:Math.cos(a), y:Math.sin(a)};
    a += Math.PI / 6; // circle divided by 12 months = 30 degrees
  }
  createCanvas(canvassize, canvassize);
  colorMode(RGB);
  cool    = color(  0,   0, 255); // blue
  neutral = color(255, 255, 255); // white
  warm    = color(255,   0,   0); // red
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  chkGrid = createCheckbox('grid', true);
  chkAxes = createCheckbox('axes', false);
  chkTicks = createCheckbox('ticks', false);
  chkAxes.changed(axeschanged);
  chkTicks.changed(tickschanged);
  radioGraphtype = createRadio();
  radioGraphtype.option('1', 'linear');
  radioGraphtype.option('2', 'sqrt');
  radioGraphtype.option('3', 'log');
  radioGraphtype.selected('1');
}

function draw() {
  // Erase canvas, set origin/scale
  background(bgcolour);
  translate(origin, origin);
  scale(scalefactor);

  // Graph type
  switch (radioGraphtype.value()) {
    case '1': func = rlin; break;
    case '2': func = rsqr; break;
    case '3': func = rlog; break;
  }

  // Grid and axes
  if (chkGrid.checked())
    showgrid(0.5);
  if (chkAxes.checked())
    showaxes(chkTicks.checked() ? 0.25 : 0);

  // Reference circles
  refcircle(0);
  refcircle(1);
  refcircle(1.5);

  // Month labels
  textSize(textheight1);
  noStroke();
  fill(255);
  for (let i = 0; i < months.length; ++i) {
    text(months[i], 0, monthradius);
    rotate(Math.PI / 6); // circle divided by 12 months = 30 degrees
  }

  // Year
  textSize(textheight2);
  noStroke();
  fill(neutral);
  text(data.getString(Math.floor(index / months.length), 0), 0, 16 * pixelsize);

  // Lines from point to point
  strokeWeight(2 * pixelsize);
  noFill();
  let prevt = data.getNum(0, months[0]); // first temp anomaly in the set (Jan 1880)
  let prevr = func(prevt);
  let preva = angles[0];
  let prevx = prevr * preva.x;
  let prevy = prevr * preva.y;
  for (let i = 1; i <= index; ++i) {
    const y = Math.floor(i / months.length);
    const m = i % months.length;
    const curt = data.getNum(y, months[m]);
    const curr = func(curt);
    const cura = angles[m];
    const curx = curr * cura.x;
    const cury = curr * cura.y;
    const avgt = (prevt + curt) / 2;
    stroke(gradient(avgt));
    line(prevx, prevy, curx, cury);
    prevt = curt;
    prevr = curr;
    preva = cura;
    prevx = curx;
    prevy = cury;
  }

  // Next loop
  if (index < maxindex)
    ++index;
}