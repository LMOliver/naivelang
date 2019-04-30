'use strict';
class Compiler{
	tokenize(code){
		let regs={
			number:/\d+(?:\.\d+)?/my,
			identifier:/[A-Za-z_][A-za-z0-9_]*/my,
			space:/\s+/my,
			comment:/\/\/.*$/my,
			operator:/\-|\+|\*|(?!\/)\/|=|\(|\)/my,
			semi:/;/my,
		};
		let lastIndex=0;
		let result=[];
		while(lastIndex<code.length){
			let ok=false;
			for(let type in regs){
				let reg=regs[type];
				reg.lastIndex=lastIndex;
				let res=reg.exec(code);
				if(res!==null){
					result.push({
						type:type,
						value:res[0],
					});
					lastIndex=reg.lastIndex;
					ok=true;
					break;
				}
			}
			if(!ok){
				throw new Error(`Cannot tokenize in pos ${lastIndex}`);
			}
		}
		return result.filter(token=>!['comment','space'].includes(token.type));
	}
	prase(tokens){
		let current=0;
		function noNext(){
			return current>=tokens.length;
		}
		function getNext(){
			return tokens[current];
		}
		function nextIs(type,value){
			if(noNext())return false;
			let next=getNext();
			return next.type===type&&((typeof value==='undefined')||next.value===value);
		}
		function assertNext(type,value){
			if(noNext()){
				throw new Error(`Expected ${type}.`);
			}
			let next=getNext();
			if(next.type!==type){
				throw new Error(`Expected ${type}, found ${next.type}.`);
			}
			if((typeof value!=='undefined')&&next.value!==value){
				throw new Error(`Expected ${type} [${value}], found [${next.value}].`);
			}
		}
		function costNext(type,value){
			if(typeof type!=='undefined'){
				assertNext(type,value);
			}
			return tokens[current++];
		}

		function value(){
			if(nextIs('number')){
				return {
					type:'number',
					value:costNext().value
				};
			}else if(nextIs('identifier')){
				return {
					type:'identifier',
					value:costNext().value
				};
			}else{
				costNext('operator','(');
				let expr=expression();
				costNext('operator',')');
				return expr;
			}
		}

		function mulTerm(){
			let left=value();
			if(nextIs('operator','*')||nextIs('operator','/')){
				return {
					type:'operator',
					operator:costNext().value,
					body:[
						left,
						mulTerm(),
					],
				};
			}else{
				return left;
			}
		}

		function addTerm(){
			let left=mulTerm();
			if(nextIs('operator','+')||nextIs('operator','-')){
				return {
					type:'operator',
					operator:costNext().value,
					body:[
						left,
						addTerm(),
					],
				};
			}else{
				return left;
			}
		}

		function assignTerm(){
			let left=addTerm();
			if(nextIs('operator','=')){
				return {
					type:'operator',
					operator:costNext().value,
					body:[
						left,
						assignTerm(),
					],
				};
			}else{
				return left;
			}
		}

		function expression(){
			return assignTerm();
		}

		function statement(){
			let expr=expression();
			costNext('semi');
			return {
				type:'expression',
				body:expr,
			}
		}

		let ast={
			type:'program',
			body:[],
		}
		while(!noNext()){
			ast.body.push(statement());
		}
		return ast;
	}
	traverse(ast){
		let registers=0;
		function newRegister(){
			return {
				type:'register',
				id:registers++,
			};
		}

		let mp=new Map();
		function getRegister(id){
			if(!mp.has(id))mp.set(id,newRegister());
			return mp.get(id);
		}

		let result=[];

		const traverseTable={
			program(node){
				return {
					type:'program',
					body:node.body.map(traverseNode),
				};
			},
			number(node){
				return {
					type:'number',
					value:node.value,
				};
			},
			identifier(node){
				return getRegister(node.value);
			},
			expression(node){
				traverseNode(node.body);
			},
			operator(node){
				let reg;
				let ops=node.body.map(traverseNode);
				if(node.operator==='='){
					reg=ops[0];
					result.push({
						op:'copy',
						from:ops[1],
						to:reg,
					});
				}else{
					reg=newRegister();
					result.push({
						op:'operator',
						type:node.operator,
						left:ops[0],
						right:ops[1],
						to:reg,
					});
				}
				if(reg.type!=='register'){
					throw new Error(`Cannot assign to a ${reg.type}.`);
				}
				return reg;
			},
		};

		function traverseNode(node){
			return traverseTable[node.type](node);
		}

		traverseNode(ast);

		return result;
	}
	genCode(tr){
		function str(x){
			switch (x.type) {
				case 'number':
					return x.value;
				case 'register':
					return `r${x.id}`;
			}
		}
		return tr.map((x)=>{
			switch(x.op){
				case 'copy':
					return `${str(x.to)} := ${str(x.from)}`;
				case 'operator':
					return `${str(x.to)} := ${str(x.left)} ${x.type} ${str(x.right)}`;
			}
		}).join('\n');
	}
	compile(code){
		let tokens=this.tokenize(code);
		let ast=this.prase(tokens);
		let tr=this.traverse(ast);
		let result=this.genCode(tr);
		return result;
	}
	execute(){

	}
	run(code){

	}
};

let cp=new Compiler();

const code=`
a=2;
c=1;
b=a+c;
`;

let result;
try{
	result=cp.compile(code);
}catch(e){
	console.log(e.message);
	result=null;
}
if(result!==null){
	console.log(result);
}