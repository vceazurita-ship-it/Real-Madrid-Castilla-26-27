"use client";

import { useDraggable } from "@dnd-kit/core";

export default function PlayerToken({

player

}:any){

const{

attributes,
listeners,
setNodeRef,
transform

}=useDraggable({

id:player.id

});

const style=transform
?{
transform:`translate3d(${transform.x}px,${transform.y}px,0)`
}
:undefined;

return(

<div

ref={setNodeRef}

style={style}

{...listeners}

{...attributes}

className="cursor-grab"

>

...

</div>

)

}