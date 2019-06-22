const div: HTMLDivElement = document.createElement('div');
const newContent: Text = document.createTextNode('hi!');
div.appendChild(newContent);
document.body.appendChild(div);
