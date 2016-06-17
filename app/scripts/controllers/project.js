'use strict';

angular.module('icestudio')
  .controller('ProjectCtrl', function ($scope,
                                       $rootScope,
                                       joint,
                                       nodeFs,
                                       nodeGlob,
                                       nodeRmdir,
                                       blocksStore,
                                       putils,
                                       utils) {

    $rootScope.project = {};
    $rootScope.breadcrumb = [ { id: '' }];

    // Initialize
    putils.updateProjectName('untitled');

    // Events

    $rootScope.$on('new', function(event) {
      alertify.prompt('Enter the project\'s title', 'untitled',
        function(evt, name) {
          if (name) {
            putils.updateProjectName(name);
            clearGraph();
            alertify.success('New project created');
          }
      });
    });

    $rootScope.$on('load', function(event, filepath) {
      var name = utils.basename(filepath);
      putils.updateProjectName(name);
      loadProject(filepath);
    });

    $rootScope.$on('save', function(event, filepath) {
      var name = utils.basename(filepath);
      putils.updateProjectName(name);
      saveProject(filepath);
    });

    $rootScope.$on('loadCustom', function(event, name) {
      putils.updateProjectName(name);
      loadCustom(name);
    });

    $rootScope.$on('saveCustom', function(event) {
      alertify.prompt('Do you want to export your custom block?',
        $rootScope.project.name,
        function(evt, name) {
          if (name) {
            putils.updateProjectName(name);
            saveCustom(name);
          }
      });
    });

    $rootScope.$on('removeCustom', function(event, name) {
      alertify.confirm('Do you want to remove custom block ' + name + '?',
        function() {
          removeCustom(name);
      });
    });

    $rootScope.$on('remove', function(event) {
      removeBlock();
    });

    $(document).on('keydown', function(event) {
      if (event.keyCode == 46) { // Supr
        removeBlock();
      }
    });

    $rootScope.$on('clear', function(event) {
      alertify.confirm('Do you want to clear the graph?',
        function() {
          clearGraph();
          alertify.success('Graph cleared');
      });
    });

    $rootScope.$on('addBlock', function(event, data) {
      if (paper.options.interactive) {
        data.id = null;
        data.x = 100;
        data.y = 100;
        if (data.type === 'io.input' || data.type == 'io.output') {
          alertify.prompt('Insert the block label', '',
            function(evt, label) {
              if (label) {
                data.block.label = label;
                addBlock(data);
                alertify.success('Block ' + data.type + ' added');
              }
          });
        }
        else {
          addBlock(data);
          alertify.success('Block ' + data.type + ' added');
        }
        refreshProject();
      }
    });

    $scope.breadcrumbNavitate = function(selectedItem) {
      var item;
      do {
        $rootScope.breadcrumb.pop();
        item = $rootScope.breadcrumb.slice(-1)[0];
      }
      while (selectedItem.name != item.name);

      if ($rootScope.breadcrumb.length == 1) {
        loadGraph($scope.project, true);
      }
      else {
        var type = selectedItem.type.split('.')
        loadGraph($rootScope.blocks[type[0]][type[1]], false);
      }
    }

    $scope.selectedCell = null;

    // Graph
    var graph = new joint.dia.Graph();

    // Paper
    var paper = new joint.dia.Paper({
      el: $('#paper'),
      width: 900,
      height: 443,
      model: graph,
      gridSize: 1,
      snapLinks: { radius: 30 },
      defaultLink: new joint.shapes.ice.Wire(),
      validateConnection: function(cellViewS, magnetS,
                                   cellViewT, magnetT,
                                   end, linkView) {
        // Prevent loop linking
        return (magnetS !== magnetT);
      }
    });

    // Paper events

    paper.on('cell:pointerclick',
      function(cellView, evt, x, y) {
        if (paper.options.interactive) {
          if ($scope.selectedCell) {
            V(paper.findViewByModel($scope.selectedCell).el).removeClass('highlighted');
          }
          $scope.selectedCell = cellView.model;
          V(paper.findViewByModel($scope.selectedCell).el).addClass('highlighted');
        }
      }
    );

    paper.on('cell:pointerdblclick',
      function(cellView, evt, x, y) {
        var data = cellView.model.attributes;
        if (data.blockType == 'io.input' || data.blockType == 'io.output') {
          if (paper.options.interactive) {
            alertify.prompt('Insert the block label', '',
              function(evt, label) {
                if (label) {
                  data.attrs['.block-label'].text = label;
                  cellView.update();
                  alertify.success('Label updated');
                }
            });
          }
        }
        else {
          if (data.block.code.type == 'graph') {
            $rootScope.breadcrumb.push({ type: data.blockType, name: data.block.name });
            $rootScope.$apply();
            if ($rootScope.breadcrumb.length == 2) {
              refreshProject(function() {
                loadGraph(data.block, false);
              });
            }
            else {
              loadGraph(data.block, false);
            }
          }
          else if (data.block.code.type == 'verilog') {
            var code = hljs.highlightAuto(data.block.code.data).value;
            alertify.alert('<pre><code class="verilog">' + code + '</code></pre>');
          }
        }
      }
    );

    paper.on('blank:pointerclick',
      function() {
        if (paper.options.interactive) {
          if ($scope.selectedCell) {
            V(paper.findViewByModel($scope.selectedCell).el).removeClass('highlighted');
          }
        }
      }
    );




    // Functions

    function paperEnable(value) {
      paper.options.interactive = value;
      if (value) {
        angular.element('#paper').css('opacity', '1.0');
      }
      else {
        angular.element('#paper').css('opacity', '0.5');
      }
    }

    function loadProject(filepath) {
      $.getJSON(filepath, function(project) {
        $scope.project = project;
        loadGraph(project, true);
        alertify.success('Project ' + project.name + ' loaded');
      });
    }

    function loadCustom(name) {
      var filepath = 'res/blocks/custom/' + name + '/' + name + '.json';
      $.getJSON(filepath, function(project) {
        $scope.project = project;
        loadGraph(project, true);
        alertify.success('Custom block ' + project.name + ' loaded');
      });
    }

    function loadGraph(data, interactive) {

      var ports = data.ports;
      var blocks = data.code.data.blocks;
      var wires = data.code.data.wires;

      paperEnable(interactive);

      if (data.code.type !== 'graph')
        return 0;

      graph.clear();
      delete $scope.selectedCell;

      // Blocks
      for (var i = 0; i < blocks.length; i++) {
        var data = {};
        data.type = blocks[i].type;
        var type = blocks[i].type.split('.')
        data.block = $rootScope.blocks[type[0]][type[1]];
        data.id = blocks[i].id;
        data.x = blocks[i].x;
        data.y = blocks[i].y;

        // Set custom labels
        if (data.type === 'io.input') {
          for (var _in = 0; _in < ports.in.length; _in++) {
            if (ports.in[_in].id == data.id) {
              data.block.label = ports.in[_in].label;
            }
          }
        }
        if (data.type === 'io.output') {
          for (var _out = 0; _out < ports.out.length; _out++) {
            if (ports.out[_out].id == data.id) {
              data.block.label = ports.out[_out].label;
            }
          }
        }

        addBlock(data);
      }

      // Wires
      for (var i = 0; i < wires.length; i++) {
        var source = graph.getCell(wires[i].source.block);
        var target = graph.getCell(wires[i].target.block);

        // Find selectors
        var sourceSelector, targetSelector;

        for (var _out = 0; _out < source.attributes.outPorts.length; _out++) {
          if (source.attributes.outPorts[_out] == wires[i].source.port) {
            sourcePort = _out;
            break;
          }
        }

        for (var _in = 0; _in < source.attributes.inPorts.length; _in++) {
          if (target.attributes.inPorts[_in] == wires[i].target.port) {
            targetPort = _in;
            break;
          }
        }

        var wire = new joint.shapes.ice.Wire({
          source: { id: source.id, selector: sourceSelector, port: wires[i].source.port },
          target: { id: target.id, selector: targetSelector, port: wires[i].target.port },
        });
        graph.addCell(wire);
      }

      //paper.scale(1.5, 1.5);
    }

    function addBlock(data) {

      var width = 50;
      var numPorts = Math.max(data.block.ports.in.length, data.block.ports.out.length);

      if (data.block.ports.in.length) width += 50;
      if (data.block.ports.out.length) width += 50;

      var shape = joint.shapes.ice.Block;
      if (data.type === 'io.input' || data.type == 'io.output') {
        shape = joint.shapes.ice.IO;
      }

      var block = new shape({
        id: data.id,
        block: data.block,
        blockType: data.type,
        inPorts: data.block.ports.in,
        outPorts: data.block.ports.out,
        position: { x: data.x, y: data.y },
        size: { width: width, height: 30 + 20 * numPorts },
        attrs: { '.block-label': { text: data.block.label } }
      });

      graph.addCell(block);
    }

    function refreshProject(callback) {

      var graphData = graph.toJSON();

      // Header

      $scope.project.label = $scope.project.name.toUpperCase();

      // Ports

      var inPorts = [];
      var outPorts = [];

      for (var c = 0; c < graphData.cells.length; c++) {
        var cell = graphData.cells[c];
        if (cell.blockType) {
          if (cell.blockType == 'io.input') {
            inPorts.push({id: cell.id, label: cell.attrs['.block-label'].text });
          }
          else if (cell.blockType == 'io.output') {
            outPorts.push({id: cell.id, label: cell.attrs['.block-label'].text });
          }
        }
      }

      $scope.project.ports = { in: inPorts, out: outPorts };

      // Code

      var blocks = [];
      var wires = [];

      for (var c = 0; c < graphData.cells.length; c++) {
        var cell = graphData.cells[c];
        if (cell.type == 'ice.Block' || cell.type == 'ice.IO') {
          var block = {};
          block.id = cell.id;
          block.type = cell.blockType;
          block.x = cell.position.x;
          block.y = cell.position.y;
          blocks.push(block);
        }
        else if (cell.type == 'ice.Wire') {
          var wire = {};
          wire.source = { block: cell.source.id, port: cell.source.port };
          wire.target = { block: cell.target.id, port: cell.target.port };
          wires.push(wire);
        }
      }

      $scope.project.code = { type: 'graph', data: { blocks: blocks, wires: wires } };

      if (callback)
        callback();
    }

    function saveProject(filepath) {

      var graphData = graph.toJSON();
      var name = utils.basename(filepath);

      $scope.project.name = name;
      refreshProject();

      nodeFs.writeFile(filepath, JSON.stringify($scope.project, null, 2),
        function(err) {
          if (!err) {
            console.log('File ' + name + ' saved');
          }
      });
    }

    function saveCustom() {
      var filepath = 'app/res/blocks/custom/' + $rootScope.project.name;
      try {
        nodeFs.mkdirSync(filepath);
      } catch(e) {
        if ( e.code != 'EEXIST' ) throw e;
      }
      saveProject(filepath + '/' + $rootScope.project.name + '.json');
      // Refresh menu blocks
      blocksStore.loadBlocks();
      alertify.success('Project ' + $rootScope.project.name + ' exported to custom blocks');
    }

    function removeCustom(name) {
      var filepath = 'app/res/blocks/custom/' + name;
      nodeRmdir(filepath, function (err, dirs, files) {
        blocksStore.loadBlocks();
        alertify.success('Custom block ' + name + ' removed');
      });
    }

    function removeBlock() {
      if (paper.options.interactive) {
        if ($scope.selectedCell) {
          alertify.confirm('Do you want to remove the selected block?',
            function() {
              $scope.selectedCell.remove();
              delete $scope.selectedCell;
              refreshProject();
              alertify.success('Block removed');
          });
        }
      }
    }

    function clearGraph() {
      graph.clear();
      delete $scope.selectedCell;
      $rootScope.breadcrumb = [ { id: '', name: $scope.project.name }];
      $rootScope.$apply();
      paperEnable(true);
      refreshProject();
    }

  });
