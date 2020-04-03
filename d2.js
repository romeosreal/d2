'use strict'

const d2 = new class {
  constructor() {
    this.vertexShaderSource = `#version 300 es
    in vec2 a_position; /* Vertex positon */
    in uint a_color; /* Vertex color */

    uniform vec2 u_resolution; /* Used to pass in the resolution of the canvas */

    out vec4 v_color; /* Current vertex color */

    float toFloat(uint value) {
      return float(value - ((value >> 8) << 8)) / 255.0;
    }

    void main() {

      // Convert from 0->u_resolution to -1->+1 (clipspace)
      vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;

      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

      // Set color value
      v_color = vec4(toFloat(a_color), toFloat(a_color >> 8), toFloat(a_color >> 16), toFloat(a_color >> 24));
    }`;

    this.fragmentShaderSource = `#version 300 es
    precision mediump float;

    in vec4 v_color; /* Point color */

    out vec4 outColor;

    void main()
    {
      outColor = v_color;
    }`;

    console.log("d2.js successfully started");
  }

  init(canvasId) {
    d2.canvas = document.getElementById(canvasId);
    d2.gl = canvas.getContext("webgl2");

    if (!d2.gl) {
      console.error("WebGL2 is unsupported by your browser");
      return;
    }

    console.log("WebGL2 is supported");

    d2.fillColor = d2.rgb(0, 0, 0);
    d2.id = 0
    d2.SIZE_MULTIPLIER = 1.1;
    d2.autoFullscreen = false;

    d2.initProgram();

    d2.gl.viewport(0, 0, d2.canvas.width, d2.gl.canvas.height);
  }

  compileShader(type, source) {
    let shader = d2.gl.createShader(type);
    d2.gl.shaderSource(shader, source);
    d2.gl.compileShader(shader);

    let success = d2.gl.getShaderParameter(shader, d2.gl.COMPILE_STATUS);
    if (success) {
      return shader;
    }

    console.log("Shader compilation failed\n\r" + d2.gl.getShaderInfoLog(shader));
    d2.gl.deleteShader(shader);
  }

  createShaders() {
    d2.shaders = {
      vertex: d2.compileShader(d2.gl.VERTEX_SHADER, d2.vertexShaderSource),
      fragment: d2.compileShader(d2.gl.FRAGMENT_SHADER, d2.fragmentShaderSource)
    };
  }

  createProgram() {
    d2.createShaders();

    let program = d2.gl.createProgram();
    d2.gl.attachShader(program, d2.shaders.vertex);
    d2.gl.attachShader(program, d2.shaders.fragment);
    d2.gl.linkProgram(program);

    let success = d2.gl.getProgramParameter(program, d2.gl.LINK_STATUS);
    if (success) {
      return program;
    }

    console.log("Program compilation failed\n\r" + d2.gl.getProgramInfoLog(program));
    d2.gl.deleteProgram(program);
  }

  initProgram() {
    d2.program = d2.createProgram();

    d2.position = {
      ptr: d2.gl.getAttribLocation(d2.program, "a_position"),
      buff: d2.gl.createBuffer(),
      STEP_SIZE: 100, // Step for data size
      data: new Float32Array(),
      center: new Float32Array(),
      update: function(data) {
        d2.gl.bindBuffer(d2.gl.ARRAY_BUFFER, d2.position.buff);
        d2.gl.bufferData(d2.gl.ARRAY_BUFFER, d2.position.data, d2.gl.DYNAMIC_DRAW);
        d2.gl.vertexAttribPointer(d2.position.ptr, 2 /* Values count */ , d2.gl.FLOAT /* Type */ ,
          false /* Do not normalize */ , 0, 0);
      },
      init: function() {
        d2.position.data = new Float32Array(d2.position.STEP_SIZE);
        d2.position.centroid = new Float32Array(Math.floor(1 + d2.position.STEP_SIZE / 3));
        d2.gl.enableVertexAttribArray(d2.position.ptr);
      }
    };

    d2.color = {
      ptr: d2.gl.getAttribLocation(d2.program, "a_color"),
      buff: d2.gl.createBuffer(),
      STEP_SIZE: 50, // Step for data size
      data: new Uint32Array(),
      update: function() {
        d2.gl.bindBuffer(d2.gl.ARRAY_BUFFER, d2.color.buff);
        d2.gl.bufferData(d2.gl.ARRAY_BUFFER, d2.color.data, d2.gl.DYNAMIC_DRAW);
        d2.gl.vertexAttribIPointer(d2.color.ptr, 1 /* Values count */ , d2.gl.UNSIGNED_INT /* Type */ ,
          false /* Do not normalize */ , 0, 0);
      },
      init: function() {
        d2.color.data = new Uint32Array(d2.color.STEP_SIZE);
        d2.gl.enableVertexAttribArray(d2.color.ptr);
      }
    };

    d2.uniform = {
      resolution: {
        ptr: d2.gl.getUniformLocation(d2.program, "u_resolution")
      }
    };

    d2.position.init();
    d2.color.init();

  }

  rgb(r, g, b) {
    return r + (g << 8) + (b << 16) + (255 << 24);
  }

  rgba(r, g, b, a = 255) {
    return r + (g << 8) + (b << 16) + (a << 24);
  }

  triangle(x1, y1, x2, y2, x3, y3) {
    let currentArray, l;

    let hw = d2.canvas.width / 2;
    let hh = d2.canvas.height / 2;

    let id2 = d2.id << 1;
    /* Normalize position data */
    d2.position.data[id2 + 0] = x1;
    d2.position.data[id2 + 1] = y1;
    d2.position.data[id2 + 2] = x2;
    d2.position.data[id2 + 3] = y2;
    d2.position.data[id2 + 4] = x3;
    d2.position.data[id2 + 5] = y3;

    let id3 = id2 / 3;
    d2.position.centroid[id3 + 0] = (d2.position.data[id2 + 0] + d2.position.data[id2 + 2] +
      d2.position.data[id2 + 4]) / 3;
    d2.position.centroid[id3 + 1] = (d2.position.data[id2 + 1] + d2.position.data[id2 + 3] +
      d2.position.data[id2 + 5]) / 3;

    /* Check position array size */
    l = d2.position.data.length;
    if (id2 >= (l - 12)) {
      currentArray = new Float32Array(Math.round(l + d2.position.STEP_SIZE)); // Allocate memory

      d2.position.STEP_SIZE *= d2.SIZE_MULTIPLIER; // Exponential grow for memory allocation step

      for (let i = 0; i < l; i++) { // Copy data
        currentArray[i] = d2.position.data[i];
      }
      d2.position.data = currentArray;


      /* Recreate array for triangle centers */
      l = d2.position.centroid.length;
      currentArray = new Float32Array(Math.floor(1 + (d2.position.data.length / 3)));

      for (let i = 0; i < l; i++) { // Copy data
        currentArray[i] = d2.position.centroid[i];
      }
      d2.position.centroid = currentArray;

    }

    /* Color is normalized by default */
    d2.color.data[d2.id + 0] = d2.fillColor;
    d2.color.data[d2.id + 1] = d2.fillColor;
    d2.color.data[d2.id + 2] = d2.fillColor;


    /* Check position array size */
    l = d2.color.data.length;
    if (d2.id >= (l - 6)) {
      currentArray = new Uint32Array(Math.round(l + d2.color.STEP_SIZE)); // Allocate memory

      d2.color.STEP_SIZE *= 1.2; // Exponential grow for memory allocation step

      for (let i = 0; i < l; i++) { // Copy data
        currentArray[i] = d2.color.data[i];
      }

      d2.color.data = currentArray;
    }


    d2.id += 3; // Change current id

    return id2; // Return current figure start vertex index
  }

  rotateMultiple(offset, len, angle) {
    let cos = Math.cos(angle),
      sin = Math.sin(angle),
      cx, cy, x, y;
    for (var i = 0, l = len * 2, offset, index, c = d2.position.centroid, p = d2.position.data; i < l; i += 2) {
      cx = c[i];
      cy = c[i + 1];
      offset = i * 3;

      x = p[offset] - cx;
      y = p[offset + 1] - cy;
      p[offset] = (x * cos - y * sin) + cx;
      p[offset + 1] = (x * sin + y * cos) + cy;

      x = p[offset + 2] - cx;
      y = p[offset + 3] - cy;
      p[offset + 2] = (x * cos - y * sin) + cx;
      p[offset + 3] = (x * sin + y * cos) + cy;

      x = p[offset + 4] - cx;
      y = p[offset + 5] - cy;
      p[offset + 4] = (x * cos - y * sin) + cx;
      p[offset + 5] = (x * sin + y * cos) + cy;
    }
  }

  resizeToScreen(ptr, wc, hc) {
    for (var i = 0, l = ptr.length; i < l; i += 2) {
      ptr[i] *= wc;
      ptr[i + 1] *= hc;
    }
  }

  updateSize() {
    let w = d2.canvas.width,
    h = d2.canvas.height;
    d2.gl.uniform2f(d2.uniform.resolution.ptr, w, h);
    d2.gl.viewport(0, 0, w, h);
  }

  fullscreen() {
    if (d2.canvas.width != window.innerWidth || d2.canvas.height != window.innerHeight) {
      document.body.style.border = 0;
      document.body.style.padding = 0;
      document.body.style.margin = 0;
      document.body.style.backgroundColor = "white";

      let oldw = d2.canvas.width,
        oldh = d2.canvas.height;
      let w = window.innerWidth,
        h = window.innerHeight;

      let wc = w / oldw, hc = h / oldh; // Resize coefficents

      //d2.resizeToScreen(d2.position.data, wc, hc);
      //d2.resizeToScreen(d2.position.centroid, wc, hc);

      d2.canvas.width = w;
      d2.canvas.height = h;
    }
  }

  update() {
    d2.gl.useProgram(d2.program);

    if (d2.autoFullscreen) d2.fullscreen();
    d2.updateSize();

    d2.position.update();
    d2.color.update();

    d2.gl.clearColor(0, 0, 0, 0);
    d2.gl.clear(d2.gl.COLOR_BUFFER_BIT);

    d2.gl.drawArrays(d2.gl.TRIANGLES, 0, d2.id);
  }
}
