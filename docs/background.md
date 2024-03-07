# Background

In my attempts to create a video game,
I've always been drawn towards Non-Player Character behaviour.
Films and books are non-interactive (the information flows in one way),
whereas sports are interactive but only with other humans.
The fabrication of interactive characters distinguishes video games from other entertainment or creative works.

🚧

Video games lack _interactive depth_.
- We can dress them in beautiful clothes (like films).
- We can wrap them in specific interfaces (like sports).
- We can drive them using narrative and characters (like books).

🚧

But there's something missing i.e. a sophisticated model of _Karma_.

By Karma we mean "actions have consequences".
More precisely, those actions either made by the Player or somehow known by the Player.
We do not mean "good actions yield good results" and "bad actions yield bad results".
We do not mean there is a navigable narrative state machine.
We do not mean a large-scale simulation of glorified clockwork toys.
So, what do we actually mean?

🚧

The system involves three parties:
- the _Player_.
- the _Game Master_ (GM).
- the _Environment_ (Env).

The Player is human.
The GM is either human or a computer program.
The Env is the underlying computer program where games are played/created by the Player/GM.

The Player is playing, and in some sense the GM is too.
The GM could imagine they're experimenting on the Player, fabricating a reality to test the Player's responses.

🚧

Graph
- with nodes Player, GM, Env
- with edges Player <-> Env, GM -> Env, GM -> Player

🚧

Can we fabricate a GM which the Player thinks is human?

We can tackle this problem in the converse direction.
That is, we can focus on making human GMs more like programs.
If a human GM can react fluidly in realtime, we can write software which mimics or even learns this.
