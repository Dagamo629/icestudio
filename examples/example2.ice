{"nodes":[{"name":"","type":"driver0","value":0,"inline":"assign o0 = 1'b0;","id":11,"x":135,"y":113,"width":50,"outputConnectors":[{"name":"\"0\""}]},{"name":"","type":"driver1","value":1,"inline":"assign o0 = 1'b1;","id":12,"x":140,"y":251,"width":50,"outputConnectors":[{"name":"\"1\""}]},{"name":"","type":"output","value":"97","id":14,"x":475,"y":152,"width":60,"inputConnectors":[{"name":"97"}]},{"name":"AND","type":"and","id":15,"x":286,"y":140,"width":100,"inline":"assign o0 = i0 & i1;","inputConnectors":[{"name":""},{"name":""}],"outputConnectors":[{"name":""}]}],"connections":[{"source":{"nodeID":11,"connectorIndex":0},"dest":{"nodeID":15,"connectorIndex":0}},{"source":{"nodeID":12,"connectorIndex":0},"dest":{"nodeID":15,"connectorIndex":1}},{"source":{"nodeID":15,"connectorIndex":0},"dest":{"nodeID":14,"connectorIndex":0}}]}